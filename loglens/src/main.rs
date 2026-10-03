mod app;
mod browser;
mod cli;
mod clipboard;
mod config;
mod event;
mod ingest;
mod lenses;
mod output;
mod records;
mod rules;
mod signatures;
mod theme;
mod ui;
mod watchlist;
mod walkthrough;

use std::io::{self, IsTerminal, Read};

use anyhow::{Context, Result, bail};
use clap::Parser;
use crossterm::event::{
    DisableBracketedPaste, DisableMouseCapture, EnableBracketedPaste, EnableMouseCapture,
};
use crossterm::execute;

use app::App;
use cli::Cli;

fn selected_lens(cli: &Cli) -> lenses::Selection {
    match lenses::Selection::from_id(cli.lens.as_deref().unwrap_or("general-triage")) {
        Ok(lens) => lens,
        Err(error) => {
            eprintln!("loglens: {error}");
            std::process::exit(2);
        }
    }
}

fn read_machine_sources(cli: &Cli) -> Result<Vec<output::SourceText>> {
    if cli.files.is_empty() || cli.stdin {
        let mut content = String::new();
        io::stdin()
            .read_to_string(&mut content)
            .context("failed to read stdin")?;
        return Ok(vec![output::SourceText {
            name: "<stdin>".to_string(),
            path: None,
            content,
        }]);
    }

    let mut sources = Vec::new();
    for input in &cli.files {
        let path = std::path::Path::new(input);
        if input == "-" {
            let mut content = String::new();
            io::stdin()
                .read_to_string(&mut content)
                .context("failed to read stdin")?;
            sources.push(output::SourceText {
                name: "<stdin>".to_string(),
                path: None,
                content,
            });
            continue;
        }
        let outcome = ingest::resolve(path)?;
        for target in &outcome.targets {
            let content = ingest::read_text(&target.path);
            if let Some(temp_dir) = &outcome.temp_dir {
                // Remove extracted data as soon as its contents are read; the
                // machine path never needs to retain bundle files.
                if content.is_err() {
                    let _ = std::fs::remove_dir_all(temp_dir);
                }
            }
            let content = content?;
            sources.push(output::SourceText {
                name: target.name.clone(),
                path: Some(target.path.clone()),
                content,
            });
        }
        // The temp directory is intentionally dropped after its paths have
        // been read. Machine modes do not need to retain extracted bundles.
        if let Some(temp_dir) = outcome.temp_dir {
            let _ = std::fs::remove_dir_all(temp_dir);
        }
    }
    if sources.is_empty() {
        bail!("no readable text sources found");
    }
    Ok(sources)
}

/// Turn off the extra terminal modes this app enables on top of ratatui's
/// raw-mode/alt-screen (which ratatui's own panic hook restores).
fn disable_extra_modes() {
    let _ = execute!(io::stdout(), DisableMouseCapture, DisableBracketedPaste);
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // A pipe is an automation boundary. Never initialize raw mode or an
    // alternate screen when stdin is piped, stdout is redirected, or a caller
    // explicitly selected a machine format.
    let non_interactive = cli.format.is_some()
        || cli.findings.is_some()
        || cli.stdin
        || !io::stdin().is_terminal()
        || (!cli.files.is_empty() && !io::stdout().is_terminal());
    if non_interactive {
        let format = cli.format.unwrap_or(cli::OutputFormat::Raw);
        let lens = selected_lens(&cli);
        let sources = read_machine_sources(&cli)?;
        let library = signatures::Library::builtin();
        return output::write_machine(
            &sources,
            format,
            &library,
            &lens,
            cli.findings.as_deref(),
        );
    }

    let theme = theme::Theme::dark();
    // `-i` always enables for this session; otherwise honour the saved pref
    // written when the user presses `i` in the TUI. `l` persists show_legend;
    // browsing with `o` persists the last browser directory.
    let prefs = config::load();
    let ignore_case = cli.ignore_case || prefs.ignore_case;
    let explicit_cli_rules = !cli.keywords.is_empty() || !cli.regexes.is_empty();
    let (rules, watchlist_error) = if explicit_cli_rules {
        (rules::build_rules(&cli, &theme, ignore_case)?, None)
    } else {
        match watchlist::load(ignore_case) {
            Ok(Some(list)) => (list.to_rules(ignore_case, &theme)?, None),
            Ok(None) => (Vec::new(), None),
            Err(error) => (Vec::new(), Some(error.to_string())),
        }
    };
    let lens = selected_lens(&cli);
    let mut app = App::new_with_lens(&cli.files, rules, ignore_case, lens)?;
    if explicit_cli_rules {
        // CLI rules win for this run; expose that the workspace can be saved
        // explicitly rather than presenting them as the on-disk list.
        app.watchlist_dirty = true;
    }
    if let Some(error) = watchlist_error {
        app.set_watchlist_status(format!("watchlist not loaded: {error}"));
    }
    app.show_legend = prefs.show_legend;
    app.scan_on_open = prefs.scan_on_open;
    app.set_walkthrough_decision(prefs.walkthrough);
    app.restore_browser_cwd(prefs.browser_cwd);
    // Scanning is the point of the tool, so it starts on its own: this scans the
    // files just opened from the command line and arms every later open too.
    // `--no-scan` suppresses it for this run without rewriting the preference,
    // which the user can still flip from the settings panel (`,`).
    if !cli.no_scan && app.scan_on_open {
        app.enable_auto_scan();
    }
    if cli.walkthrough {
        app.replay_walkthrough();
    } else if prefs.walkthrough == walkthrough::Decision::Unseen {
        app.open_walkthrough_prompt();
    }

    let mut terminal = ratatui::init();
    let _ = execute!(io::stdout(), EnableMouseCapture, EnableBracketedPaste);

    // ratatui::init installed a panic hook that restores the base terminal
    // state; chain ours in front so a panic also disables mouse capture and
    // bracketed paste instead of leaving the shell spewing escape codes.
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        disable_extra_modes();
        prev_hook(info);
    }));

    let result = event::run(&mut terminal, &mut app);

    disable_extra_modes();
    ratatui::restore();

    result
}
