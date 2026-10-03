// @polsia:user-owned — local platform installer frontend.
use clap::Parser;
use loglens_installer::{
    MANIFEST_SIGNATURE_URL, MANIFEST_URL, SIGNATURE_SCHEME, expected_target, extract_payload,
    find_target, public_key, read_file, validate_manifest, verify_hash, verify_signature,
};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Parser)]
#[command(name = "loglens-installer", about = "Verify and install the local loglens beta")]
struct Args {
    /// Accept the current-user install, PATH, shortcut, and launch prompts.
    #[arg(long)]
    yes: bool,
    /// Do not ask to add the install directory to the user PATH.
    #[arg(long)]
    no_path: bool,
    /// Do not ask to open a new terminal after installation.
    #[arg(long)]
    no_launch: bool,
    /// Install into this user-selected directory instead of the platform default.
    #[arg(long, value_name = "DIR")]
    install_dir: Option<PathBuf>,
}

fn main() {
    if let Err(error) = run(Args::parse()) {
        eprintln!("loglens installer: {error}");
        std::process::exit(1);
    }
}

fn run(args: Args) -> anyhow::Result<()> {
    let target = expected_target();
    if target == "unsupported" {
        anyhow::bail!("this installer build does not support the current OS/architecture");
    }
    let client = reqwest::blocking::Client::builder()
        .user_agent("loglens-installer/0.1")
        .build()?;
    println!("Checking the signed loglens release manifest for {target}…");
    let manifest_bytes = download(&client, MANIFEST_URL)?;
    let manifest_signature = download(&client, MANIFEST_SIGNATURE_URL)?;
    let key = public_key()?;
    verify_signature(&manifest_bytes, &manifest_signature, &key)?;
    let manifest = validate_manifest(&manifest_bytes)?;
    let release = find_target(&manifest, target)?;

    let payload_bytes = download(&client, &release.payload.artifact.url)?;
    let payload_signature = download(&client, &release.payload.artifact.signature_url)?;
    verify_signature(&payload_bytes, &payload_signature, &key)?;
    verify_hash(&payload_bytes, &release.payload.artifact.sha256)?;

    let temp_dir = tempfile::tempdir()?;
    let extracted = extract_payload(
        &payload_bytes,
        &release.payload.archive_format,
        target,
        temp_dir.path(),
    )?;
    let executable = read_file(&extracted)?;
    verify_hash(&executable, &release.payload.executable_sha256)?;
    println!("Verified {SIGNATURE_SCHEME} signatures and SHA-256 hashes before installation.");

    let install_dir = args.install_dir.unwrap_or_else(default_install_dir);
    if !args.yes
        && !consent(&format!(
            "Install for the current user in {}? [y/N] ",
            install_dir.display()
        ))?
    {
        println!("Installation cancelled; no executable, PATH entry, shortcut, or terminal was changed.");
        return Ok(());
    }
    std::fs::create_dir_all(&install_dir)?;
    let filename = if target.contains("windows") {
        "loglens.exe"
    } else {
        "loglens"
    };
    let destination = install_dir.join(filename);
    std::fs::copy(&extracted, &destination)?;
    set_executable(&destination)?;
    println!("Installed {}", destination.display());

    if !args.no_path
        && (args.yes || consent("Add the install directory to your user PATH? [y/N] ")?)
    {
        add_to_user_path(&install_dir)?;
        println!("PATH updated for new terminals. Existing terminals may need to be reopened.");
    }
    if args.yes || consent("Create a desktop shortcut? [y/N] ")? {
        match create_shortcut(&destination) {
            Ok(()) => println!("Desktop shortcut created."),
            Err(error) => eprintln!("Shortcut not created: {error}"),
        }
    }
    if !args.no_launch
        && (args.yes || consent("Open a new terminal and launch the loglens TUI? [y/N] ")?)
    {
        if launch_terminal(&destination) {
            println!("A new terminal was opened for the interactive TUI.");
        } else {
            println!("No supported terminal could be opened. Launch it manually:");
            println!("  {}", destination.display());
        }
    }
    Ok(())
}

fn download(client: &reqwest::blocking::Client, url: &str) -> anyhow::Result<Vec<u8>> {
    Ok(client.get(url).send()?.error_for_status()?.bytes()?.to_vec())
}

fn consent(prompt: &str) -> anyhow::Result<bool> {
    print!("{prompt}");
    io::stdout().flush()?;
    let mut answer = String::new();
    io::stdin().read_line(&mut answer)?;
    Ok(matches!(
        answer.trim().to_ascii_lowercase().as_str(),
        "y" | "yes"
    ))
}

fn default_install_dir() -> PathBuf {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    if cfg!(target_os = "windows") {
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join("AppData/Local"))
            .join("LogLens/bin")
    } else if cfg!(target_os = "macos") {
        home.join("Library/Application Support/loglens/bin")
    } else {
        home.join(".local/bin")
    }
}

fn set_executable(path: &Path) -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = std::fs::metadata(path)?.permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(path, permissions)?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

#[cfg(not(windows))]
fn add_to_user_path(directory: &Path) -> anyhow::Result<()> {
    let home = PathBuf::from(
        std::env::var_os("HOME").ok_or_else(|| anyhow::anyhow!("HOME is not set"))?,
    );
    let profile = if cfg!(target_os = "macos") {
        home.join(".zprofile")
    } else {
        home.join(".profile")
    };
    let marker = "# loglens installer PATH";
    let existing = std::fs::read_to_string(&profile).unwrap_or_default();
    if existing.lines().any(|line| line.trim() == marker) {
        return Ok(());
    }
    let escaped = directory
        .to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"");
    let addition = format!("\n{marker}\nexport PATH=\"{escaped}:$PATH\"\n");
    std::fs::write(profile, format!("{existing}{addition}"))?;
    Ok(())
}

#[cfg(windows)]
fn add_to_user_path(directory: &Path) -> anyhow::Result<()> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;
    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)?;
    let current: String = key.get_value("Path").unwrap_or_default();
    let directory = directory.to_string_lossy();
    if current
        .split(';')
        .any(|entry| entry.eq_ignore_ascii_case(&directory))
    {
        return Ok(());
    }
    let updated = if current.is_empty() {
        directory.to_string()
    } else {
        format!("{current};{directory}")
    };
    key.set_value("Path", &updated)?;
    Ok(())
}

fn create_shortcut(_destination: &Path) -> anyhow::Result<()> {
    anyhow::bail!("shortcut creation is not enabled in this beta; the executable path above is ready")
}

#[cfg(target_os = "macos")]
fn launch_terminal(destination: &Path) -> bool {
    let escaped = destination
        .to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"");
    let script = format!("tell application \"Terminal\" to do script \"{escaped}\"");
    Command::new("osascript")
        .args(["-e", &script])
        .spawn()
        .is_ok()
}

#[cfg(target_os = "windows")]
fn launch_terminal(destination: &Path) -> bool {
    Command::new("cmd.exe")
        .args(["/C", "start", "loglens", "cmd.exe", "/K"])
        .arg(destination)
        .spawn()
        .is_ok()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_terminal(destination: &Path) -> bool {
    ["x-terminal-emulator", "gnome-terminal", "konsole"]
        .iter()
        .any(|terminal| {
            let mut command = Command::new(terminal);
            if *terminal == "gnome-terminal" {
                command.args(["--", &destination.to_string_lossy()]);
            } else {
                command.args(["-e", &destination.to_string_lossy()]);
            }
            command.spawn().is_ok()
        })
}

#[cfg(not(any(unix, target_os = "windows")))]
fn launch_terminal(_destination: &Path) -> bool {
    false
}
