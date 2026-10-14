use std::env;

use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::{Block, BorderType, Borders, Padding};

use crate::signatures::Severity;

/// How many distinct colors the terminal can usefully render.
///
/// Resolved once at startup from `--color`, `NO_COLOR`, `COLORTERM`, and `TERM`.
/// Every theme slot is hand-mapped to an `(Rgb, Indexed, Named)` triple so
/// Ansi16 never falls back to nearest-RGB quantization (which collapses several
/// semantic hues onto BrightBlack/White).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ColorDepth {
    Truecolor,
    Ansi256,
    Ansi16,
    Mono,
}

impl ColorDepth {
    /// Whether fancy Unicode chrome glyphs (`▰▱`, `▎`, brand `◆`) are safe.
    /// Ansi16 and Mono terminals (legacy conhost) get ASCII fallbacks.
    pub fn unicode_glyphs(self) -> bool {
        matches!(self, ColorDepth::Truecolor | ColorDepth::Ansi256)
    }
}

/// CLI / config override for color depth.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ColorMode {
    Auto,
    Always,
    Never,
    Ansi16,
    Ansi256,
    Truecolor,
}

/// CLI / config override for light vs dark.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ThemeMode {
    Dark,
    Light,
    Auto,
}

/// One palette slot with hand-mapped fallbacks for each color depth.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Slot {
    pub rgb: (u8, u8, u8),
    pub indexed: u8,
    pub named: Color,
}

impl Slot {
    pub const fn new(r: u8, g: u8, b: u8, indexed: u8, named: Color) -> Self {
        Self {
            rgb: (r, g, b),
            indexed,
            named,
        }
    }

    pub fn resolve(self, depth: ColorDepth) -> Color {
        match depth {
            ColorDepth::Truecolor => Color::Rgb(self.rgb.0, self.rgb.1, self.rgb.2),
            ColorDepth::Ansi256 => Color::Indexed(self.indexed),
            ColorDepth::Ansi16 => self.named,
            ColorDepth::Mono => Color::Reset,
        }
    }
}

/// Visual treatment for a transient status message. The wording remains the
/// source of truth; this only helps a reader distinguish outcome from action.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StatusTone {
    Success,
    Progress,
    Neutral,
    Warning,
    Error,
}

/// Viewer chrome mode shown in the status pill.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UiMode {
    Normal,
    Search,
    Filter,
}

impl UiMode {
    pub fn label(self) -> &'static str {
        match self {
            UiMode::Normal => "NORMAL",
            UiMode::Search => "SEARCH",
            UiMode::Filter => "FILTER",
        }
    }
}

/// Active UI palette. Held on [`crate::app::App`].
///
/// Direction B "Signal": teal primary + violet secondary on a dark (or light)
/// surface, with every slot depth-resolved at construction.
#[derive(Clone, Debug)]
pub struct Theme {
    pub depth: ColorDepth,
    #[allow(dead_code)]
    pub light: bool,
    pub bg: Color,
    pub surface: Color,
    pub accent: Color,
    #[allow(dead_code)] // violet twin of accent; reserved for dual-accent chrome
    pub secondary: Color,
    pub border: Color,
    pub text: Color,
    pub text_dim: Color,
    pub gutter: Color,
    pub cursor_bg: Color,
    pub status_bg: Color,
    pub status_fg: Color,
    pub match_fg: Color,
    pub search_bg: Color,
    pub search_current_bg: Color,
    pub logo_top: Color,
    pub logo_bottom: Color,
    /// Chrome semantics for the file browser: a failed directory read and a
    /// marked entry. Deliberately *not* taken from [`Theme::palette`] — the
    /// rotation belongs to the user's highlights, so borrowing an index from it
    /// would make the browser's colors change whenever that order changes.
    pub danger: Color,
    pub marked: Color,
    /// Soft foreground tints for common log levels (non-highlight text).
    pub level_error: Color,
    pub level_warn: Color,
    pub level_info: Color,
    pub level_debug: Color,
    pub sev_crit: Color,
    pub sev_high: Color,
    pub sev_med: Color,
    pub sev_low: Color,
    pub sev_info: Color,
    pub palette: Vec<Color>,
}

impl Theme {
    /// Build the Signal theme for `depth` and light/dark.
    pub fn signal(depth: ColorDepth, light: bool) -> Self {
        if light {
            Self::signal_light(depth)
        } else {
            Self::signal_dark(depth)
        }
    }

    /// Dark Signal (Direction B default).
    pub fn dark() -> Self {
        Self::signal(ColorDepth::Truecolor, false)
    }

    /// Light Signal variant.
    #[allow(dead_code)]
    pub fn light() -> Self {
        Self::signal(ColorDepth::Truecolor, true)
    }

    /// Resolve depth + light/dark from CLI overrides and the environment.
    pub fn from_prefs(color: ColorMode, theme_mode: ThemeMode) -> Self {
        let depth = resolve_color_depth(color);
        let light = resolve_light(theme_mode);
        Self::signal(depth, light)
    }

    fn signal_dark(depth: ColorDepth) -> Self {
        let r = |s: Slot| s.resolve(depth);
        // Signal dark palette — HoD Direction B table (hand-mapped Named column).
        let bg = Slot::new(0x0F, 0x11, 0x17, 233, Color::Black);
        let surface = Slot::new(0x1A, 0x1D, 0x27, 235, Color::Black);
        let text = Slot::new(0xD7, 0xDA, 0xE0, 253, Color::White);
        let text_dim = Slot::new(0x73, 0x7A, 0x8C, 243, Color::DarkGray);
        let accent = Slot::new(0x3E, 0xE0, 0xD8, 80, Color::Cyan);
        let secondary = Slot::new(0x8B, 0x7C, 0xF6, 141, Color::Magenta);
        let border = Slot::new(0x2B, 0x30, 0x40, 237, Color::DarkGray);
        let gutter = Slot::new(0x5A, 0x61, 0x72, 241, Color::DarkGray);
        let cursor_bg = Slot::new(0x23, 0x27, 0x31, 236, Color::DarkGray);
        // Ink on filled chips (HIGH/MED badges need ≥4.5:1 on amber/orange).
        let match_fg = Slot::new(0x0B, 0x0F, 0x14, 232, Color::Black);
        let search_bg = secondary;
        let search_current = accent;
        let logo_top = Slot::new(0x5B, 0x84, 0xEF, 69, Color::Blue);
        let logo_bottom = accent;
        let danger = Slot::new(0xE0, 0x6C, 0x75, 168, Color::Red);
        let marked = Slot::new(0x98, 0xC3, 0x79, 114, Color::Green);
        let level_error = Slot::new(0xE0, 0x6C, 0x75, 168, Color::Red);
        let level_warn = Slot::new(0xE5, 0xC0, 0x7B, 179, Color::Yellow);
        let level_info = Slot::new(0x7F, 0xA7, 0xCF, 110, Color::Blue);
        let level_debug = text_dim;
        // Severity: HoD Signal — LightRed/Red/Yellow/Blue Named fallbacks.
        let sev_crit = Slot::new(0xFF, 0x5F, 0x6D, 203, Color::LightRed);
        let sev_high = Slot::new(0xFF, 0x9F, 0x43, 215, Color::Red);
        let sev_med = Slot::new(0xF7, 0xC9, 0x48, 221, Color::Yellow);
        let sev_low = Slot::new(0x5A, 0xA9, 0xFF, 75, Color::Blue);
        let sev_info = text_dim;

        Self {
            depth,
            light: false,
            bg: r(bg),
            surface: r(surface),
            accent: r(accent),
            secondary: r(secondary),
            border: r(border),
            text: r(text),
            text_dim: r(text_dim),
            gutter: r(gutter),
            cursor_bg: r(cursor_bg),
            status_bg: r(surface),
            status_fg: r(text_dim),
            match_fg: r(match_fg),
            search_bg: r(search_bg),
            search_current_bg: r(search_current),
            logo_top: r(logo_top),
            logo_bottom: r(logo_bottom),
            danger: r(danger),
            marked: r(marked),
            level_error: r(level_error),
            level_warn: r(level_warn),
            level_info: r(level_info),
            level_debug: r(level_debug),
            sev_crit: r(sev_crit),
            sev_high: r(sev_high),
            sev_med: r(sev_med),
            sev_low: r(sev_low),
            sev_info: r(sev_info),
            palette: highlight_palette(depth, false),
        }
    }

    fn signal_light(depth: ColorDepth) -> Self {
        let r = |s: Slot| s.resolve(depth);
        // HoD light variant: bg #F6F7FB, accent #0E8C86, secondary #5B4BD6.
        let bg = Slot::new(0xF6, 0xF7, 0xFB, 255, Color::White);
        let surface = Slot::new(0xE8, 0xEA, 0xF2, 254, Color::White);
        let text = Slot::new(0x2B, 0x2F, 0x36, 236, Color::Black);
        let text_dim = Slot::new(0x6B, 0x71, 0x80, 243, Color::DarkGray);
        let accent = Slot::new(0x0E, 0x8C, 0x86, 30, Color::Cyan);
        let secondary = Slot::new(0x5B, 0x4B, 0xD6, 62, Color::Magenta);
        let border = Slot::new(0xC5, 0xC9, 0xD4, 251, Color::Gray);
        let gutter = Slot::new(0x8A, 0x8F, 0x98, 245, Color::DarkGray);
        let cursor_bg = Slot::new(0xE0, 0xE3, 0xEC, 253, Color::Gray);
        let match_fg = Slot::new(0xF6, 0xF7, 0xFB, 255, Color::White);
        let search_bg = secondary;
        let search_current = accent;
        let logo_top = Slot::new(0x2F, 0x6F, 0xA8, 67, Color::Blue);
        let logo_bottom = accent;
        let danger = Slot::new(0xC4, 0x3E, 0x4A, 167, Color::Red);
        let marked = Slot::new(0x3D, 0x8B, 0x4A, 71, Color::Green);
        let level_error = danger;
        let level_warn = Slot::new(0xB0, 0x7D, 0x1A, 178, Color::Yellow);
        let level_info = Slot::new(0x2F, 0x6F, 0xA8, 67, Color::Blue);
        let level_debug = text_dim;
        let sev_crit = Slot::new(0xD9, 0x3A, 0x4A, 203, Color::LightRed);
        let sev_high = Slot::new(0xD9, 0x7A, 0x1A, 208, Color::Red);
        let sev_med = Slot::new(0xB0, 0x8A, 0x10, 178, Color::Yellow);
        let sev_low = Slot::new(0x2F, 0x6F, 0xA8, 67, Color::Blue);
        let sev_info = text_dim;

        Self {
            depth,
            light: true,
            bg: r(bg),
            surface: r(surface),
            accent: r(accent),
            secondary: r(secondary),
            border: r(border),
            text: r(text),
            text_dim: r(text_dim),
            gutter: r(gutter),
            cursor_bg: r(cursor_bg),
            status_bg: r(surface),
            status_fg: r(text_dim),
            match_fg: r(match_fg),
            search_bg: r(search_bg),
            search_current_bg: r(search_current),
            logo_top: r(logo_top),
            logo_bottom: r(logo_bottom),
            danger: r(danger),
            marked: r(marked),
            level_error: r(level_error),
            level_warn: r(level_warn),
            level_info: r(level_info),
            level_debug: r(level_debug),
            sev_crit: r(sev_crit),
            sev_high: r(sev_high),
            sev_med: r(sev_med),
            sev_low: r(sev_low),
            sev_info: r(sev_info),
            palette: highlight_palette(depth, true),
        }
    }

    pub fn rule_color(&self, index: usize) -> Color {
        self.palette[index % self.palette.len()]
    }

    pub fn severity_color(&self, severity: Severity) -> Color {
        match severity {
            Severity::Critical => self.sev_crit,
            Severity::High => self.sev_high,
            Severity::Medium => self.sev_med,
            Severity::Low => self.sev_low,
            Severity::Info => self.sev_info,
        }
    }

    /// Plain panel. Only the focused pane gets the accent border (Signal).
    pub fn panel(&self, title: &str, active: bool) -> Block<'static> {
        let border_color = if active { self.accent } else { self.border };
        let title_style = if active {
            Style::default()
                .fg(self.accent)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default()
                .fg(self.text_dim)
                .add_modifier(Modifier::BOLD)
        };
        Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(border_color))
            .padding(Padding::horizontal(1))
            .title(Line::from(title.to_string()))
            .title_style(title_style)
    }

    /// Panel without inner padding (log body — padding would waste columns).
    pub fn panel_tight(&self, title: &str, active: bool) -> Block<'static> {
        self.panel(title, active).padding(Padding::ZERO)
    }

    /// Near-black (or near-white on light) text on every filled semantic surface.
    ///
    /// Chip ink is always [`Self::match_fg`] (`#0B0F14` on Signal dark truecolor)
    /// — never white — so HIGH/MED amber fills keep ≥4.5:1 contrast.
    pub fn filled(&self, background: Color) -> Style {
        Style::default()
            .fg(self.match_fg)
            .bg(background)
            .add_modifier(Modifier::BOLD)
    }

    /// The selected-row treatment used by the log, findings, settings, and
    /// watchlist workspaces.
    ///
    /// Truecolor/256: a soft wash that leaves per-span foregrounds intact.
    /// Ansi16/Mono: `DarkGray` wash (not `REVERSED` — that flipped severity chip
    /// fills). Callers must paint selected gutter / location text in a light
    /// fg (`text` / White); dim DarkGray-on-DarkGray is unreadable on conhost.
    /// Span backgrounds (badges) still win over the wash.
    pub fn selected_row(&self) -> Style {
        match self.depth {
            ColorDepth::Ansi16 | ColorDepth::Mono => Style::default().bg(Color::DarkGray),
            ColorDepth::Truecolor | ColorDepth::Ansi256 => Style::default().bg(self.cursor_bg),
        }
    }

    /// Severity badges and dots remain owned by the severity vocabulary rather
    /// than the user highlight rotation.
    ///
    /// Always dark ink via [`Self::filled`] — list chips and detail chips share
    /// this path so HIGH/MED never render white-on-amber.
    pub fn severity_badge(&self, severity: Severity) -> Style {
        self.filled(self.severity_color(severity))
    }

    /// Labels that identify where evidence came from are intentionally
    /// structural: accent + bold, never a highlight hue.
    pub fn source_label(&self) -> Style {
        Style::default()
            .fg(self.accent)
            .add_modifier(Modifier::BOLD)
    }

    pub fn provenance(&self) -> Style {
        Style::default().fg(self.text_dim)
    }

    pub fn evidence(&self) -> Style {
        Style::default().fg(self.text)
    }

    /// Mode pill: accent fill + bold label (NORMAL / SEARCH / FILTER).
    pub fn mode_pill(&self, _mode: UiMode) -> Style {
        Style::default()
            .fg(self.match_fg)
            .bg(self.accent)
            .add_modifier(Modifier::BOLD)
    }

    /// Brand mark glyph with ASCII fallback for Ansi16/Mono.
    pub fn brand_mark(&self) -> &'static str {
        if self.depth.unicode_glyphs() {
            "\u{25C6}" // ◆
        } else {
            "*"
        }
    }

    /// Findings-bar filled cell.
    pub fn bar_filled(&self) -> &'static str {
        if self.depth.unicode_glyphs() {
            "\u{25B0}" // ▰
        } else {
            "="
        }
    }

    /// Findings-bar empty cell.
    pub fn bar_empty(&self) -> &'static str {
        if self.depth.unicode_glyphs() {
            "\u{25B1}" // ▱
        } else {
            "-"
        }
    }

    /// Selection / pill leading edge.
    pub fn pill_lead(&self) -> &'static str {
        if self.depth.unicode_glyphs() {
            "\u{258C}" // ▌
        } else {
            "|"
        }
    }

    /// Selection / pill trailing edge.
    #[allow(dead_code)]
    pub fn pill_trail(&self) -> &'static str {
        if self.depth.unicode_glyphs() {
            "\u{2590}" // ▐
        } else {
            "|"
        }
    }

    /// Severity gutter dot.
    pub fn severity_dot(&self) -> &'static str {
        if self.depth.unicode_glyphs() {
            "\u{25CF}" // ●
        } else {
            "*"
        }
    }

    /// Classify existing status language without changing it. This is kept
    /// deliberately conservative so a new message defaults to neutral rather
    /// than receiving an invented meaning.
    pub fn status_tone(message: &str) -> StatusTone {
        let message = message.to_ascii_lowercase();
        if [
            "failed",
            "failure",
            "invalid",
            "cannot",
            "could not",
            "error",
            "not loaded",
        ]
        .iter()
        .any(|needle| message.contains(needle))
        {
            StatusTone::Error
        } else if ["scanning", "updating", "rescan"]
            .iter()
            .any(|needle| message.contains(needle))
        {
            StatusTone::Progress
        } else if message.contains("no matches") || message.contains("no search matches") {
            // Zero-hit search is the one place status goes Error-red.
            StatusTone::Error
        } else if [
            "cancelled",
            "limit reached",
            "nothing to",
            "no findings",
            "empty",
        ]
        .iter()
        .any(|needle| message.contains(needle))
        {
            StatusTone::Warning
        } else if [
            "saved", "exported", "added", "removed", "reloaded", "opened", "jumped", "copied",
            "updated",
        ]
        .iter()
        .any(|needle| message.contains(needle))
        {
            StatusTone::Success
        } else {
            StatusTone::Neutral
        }
    }

    pub fn status_style(&self, tone: StatusTone) -> Style {
        let fg = match tone {
            StatusTone::Success => self.marked,
            StatusTone::Progress => self.accent,
            StatusTone::Neutral => self.status_fg,
            StatusTone::Warning => self.level_warn,
            StatusTone::Error => self.danger,
        };
        let style = Style::default().fg(fg).bg(self.status_bg);
        if matches!(
            tone,
            StatusTone::Success | StatusTone::Progress | StatusTone::Error
        ) {
            style.add_modifier(Modifier::BOLD)
        } else {
            style
        }
    }
}

/// Highlight rotation slots with depth-aware resolution. Order is a contract:
/// clean hues first, then the four that collide with level/severity semantics.
fn highlight_palette(depth: ColorDepth, light: bool) -> Vec<Color> {
    let slots = if light {
        [
            Slot::new(0x3D, 0x8B, 0x4A, 71, Color::Green), // moss
            Slot::new(0x9B, 0x4D, 0xCA, 134, Color::Magenta), // orchid
            Slot::new(0x9A, 0x7B, 0x2F, 178, Color::Yellow), // brass
            Slot::new(0x1A, 0x8A, 0x96, 37, Color::Cyan),  // cyan
            Slot::new(0xC4, 0x5A, 0x8A, 168, Color::LightMagenta), // rose
            Slot::new(0x2A, 0x9A, 0x7A, 36, Color::Green), // mint
            Slot::new(0x5A, 0x6A, 0xC8, 62, Color::Blue),  // periwinkle
            Slot::new(0x7A, 0x9A, 0x2A, 106, Color::Yellow), // lime
            Slot::new(0xC4, 0x7A, 0x2A, 172, Color::Yellow), // tangerine
            Slot::new(0xC4, 0x3E, 0x4A, 167, Color::Red),  // coral
            Slot::new(0xB0, 0x7D, 0x1A, 178, Color::Yellow), // amber
            Slot::new(0x2F, 0x6F, 0xA8, 67, Color::Blue),  // azure
        ]
    } else {
        [
            Slot::new(0x98, 0xC3, 0x79, 114, Color::Green), // moss
            Slot::new(0xC6, 0x78, 0xDD, 176, Color::Magenta), // orchid
            Slot::new(0xD0, 0xB0, 0x6A, 179, Color::Yellow), // brass
            Slot::new(0x56, 0xB6, 0xC2, 73, Color::Cyan),   // cyan
            Slot::new(0xEC, 0x8C, 0xB0, 211, Color::LightMagenta), // rose
            Slot::new(0x5F, 0xC9, 0xA6, 79, Color::Green),  // mint
            Slot::new(0x9A, 0xA7, 0xF0, 147, Color::Blue),  // periwinkle
            Slot::new(0xB5, 0xCE, 0x6C, 149, Color::Yellow), // lime
            Slot::new(0xE8, 0x9B, 0x54, 215, Color::Yellow), // tangerine
            Slot::new(0xE0, 0x6C, 0x75, 168, Color::Red),   // coral
            Slot::new(0xE5, 0xC0, 0x7B, 179, Color::Yellow), // amber
            Slot::new(0x61, 0xAF, 0xEF, 75, Color::Blue),   // azure
        ]
    };
    slots.into_iter().map(|s| s.resolve(depth)).collect()
}

/// Resolve [`ColorDepth`] from a CLI override and the process environment.
pub fn resolve_color_depth(mode: ColorMode) -> ColorDepth {
    match mode {
        ColorMode::Never => ColorDepth::Mono,
        ColorMode::Ansi16 => ColorDepth::Ansi16,
        ColorMode::Ansi256 => ColorDepth::Ansi256,
        ColorMode::Truecolor => ColorDepth::Truecolor,
        ColorMode::Always => detect_color_depth().max_with(ColorDepth::Ansi16),
        ColorMode::Auto => {
            if env::var_os("NO_COLOR").is_some() {
                ColorDepth::Mono
            } else {
                detect_color_depth()
            }
        }
    }
}

trait DepthOrd {
    fn max_with(self, other: Self) -> Self;
}

impl DepthOrd for ColorDepth {
    fn max_with(self, other: Self) -> Self {
        use ColorDepth::*;
        let rank = |d: ColorDepth| match d {
            Mono => 0,
            Ansi16 => 1,
            Ansi256 => 2,
            Truecolor => 3,
        };
        if rank(self) >= rank(other) {
            self
        } else {
            other
        }
    }
}

/// Detect color depth from `COLORTERM` / `TERM` (and crossterm when available).
pub fn detect_color_depth() -> ColorDepth {
    if env::var_os("NO_COLOR").is_some() {
        return ColorDepth::Mono;
    }
    if let Ok(ct) = env::var("COLORTERM") {
        let ct = ct.to_ascii_lowercase();
        if ct.contains("truecolor") || ct.contains("24bit") {
            return ColorDepth::Truecolor;
        }
    }
    if let Ok(term) = env::var("TERM") {
        let term = term.to_ascii_lowercase();
        if term.contains("truecolor") || term == "xterm-direct" {
            return ColorDepth::Truecolor;
        }
        if term.contains("256color") || term.contains("256") {
            return ColorDepth::Ansi256;
        }
        if term == "dumb" {
            return ColorDepth::Mono;
        }
    }
    // Crossterm reports available colors when the terminal supports querying.
    // On modern Windows VT hosts this often returns u16::MAX to mean truecolor.
    let n = crossterm::style::available_color_count();
    if n >= 256 {
        // Distinguish truecolor hosts that advertise 256 via TERM alone above;
        // when the count saturates (or exceeds 256) prefer truecolor.
        if n > 256 || env::var("COLORTERM").is_ok() {
            ColorDepth::Truecolor
        } else {
            ColorDepth::Ansi256
        }
    } else {
        ColorDepth::Ansi16
    }
}

fn resolve_light(mode: ThemeMode) -> bool {
    match mode {
        ThemeMode::Dark => false,
        ThemeMode::Light => true,
        ThemeMode::Auto => detect_light_background(),
    }
}

/// Best-effort light-background detection. Prefer `COLORFGBG` (bg index > 8
/// usually means a light palette). Never blocks on OSC queries.
pub fn detect_light_background() -> bool {
    if let Ok(cfg) = env::var("COLORFGBG") {
        // Format: `fg;bg` or `fg;bg;…` — bg is the last semicolon field.
        if let Some(bg) = cfg.split(';').next_back()
            && let Ok(idx) = bg.parse::<u8>()
        {
            // Common convention: 0–8 dark, 9–15 light-ish; 15 is white.
            return idx >= 9;
        }
    }
    false
}

/// Linear blend between two colors; `t` runs 0.0 (a) → 1.0 (b).
/// Non-RGB colors fall back to `a` — callers that need a gradient on Ansi16
/// should paint a solid accent instead (see welcome logo).
pub fn lerp_color(a: Color, b: Color, t: f64) -> Color {
    let parts = |c: Color| match c {
        Color::Rgb(r, g, bl) => Some((r, g, bl)),
        _ => None,
    };
    match (parts(a), parts(b)) {
        (Some((ar, ag, ab)), Some((br, bg, bb))) => {
            let mix =
                |x: u8, y: u8| (x as f64 + (y as f64 - x as f64) * t.clamp(0.0, 1.0)).round() as u8;
            Color::Rgb(mix(ar, br), mix(ag, bg), mix(ab, bb))
        }
        _ => a,
    }
}

/// Soft base foreground for a log line from common level tokens.
/// Prefer [`level_token_styled`] when painting so only the token itself is tinted.
#[cfg_attr(not(test), allow(dead_code))]
pub fn level_fg(text: &str, theme: &Theme) -> Color {
    match detect_level(text) {
        Some((Level::Error, _)) => theme.level_error,
        Some((Level::Warn, _)) => theme.level_warn,
        Some((Level::Info, _)) => theme.level_info,
        Some((Level::Debug, _)) => theme.level_debug,
        None => theme.text,
    }
}

/// Level token range plus the theme color for that level.
pub fn level_token_styled(text: &str, theme: &Theme) -> Option<(Color, std::ops::Range<usize>)> {
    let (level, range) = detect_level(text)?;
    let color = match level {
        Level::Error => theme.level_error,
        Level::Warn => theme.level_warn,
        Level::Info => theme.level_info,
        Level::Debug => theme.level_debug,
    };
    Some((color, range))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Level {
    Error,
    Warn,
    Info,
    Debug,
}

/// Scan for the leftmost level token and return it with its byte range.
///
/// The first hit is the log-level column in standard formats. Later words like
/// lowercase `alert` inside a message must not steal the tint from `INFO`.
fn detect_level(text: &str) -> Option<(Level, std::ops::Range<usize>)> {
    // Scan whitespace/punctuation-separated tokens so "TERROR" / "warningly"
    // don't false-positive, while "ERROR", "[WARN]", "level=info" still match.
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        while i < bytes.len() && !bytes[i].is_ascii_alphabetic() {
            i += 1;
        }
        let start = i;
        while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
            i += 1;
        }
        if start == i {
            break;
        }
        let token = &text[start..i];
        let level = if eq_ignore_ascii(token, "ERROR")
            || eq_ignore_ascii(token, "ERR")
            || eq_ignore_ascii(token, "FATAL")
            || eq_ignore_ascii(token, "CRITICAL")
            || eq_ignore_ascii(token, "CRIT")
            || eq_ignore_ascii(token, "ALERT")
        {
            Some(Level::Error)
        } else if eq_ignore_ascii(token, "WARN") || eq_ignore_ascii(token, "WARNING") {
            Some(Level::Warn)
        } else if eq_ignore_ascii(token, "INFO") {
            Some(Level::Info)
        } else if eq_ignore_ascii(token, "DEBUG") || eq_ignore_ascii(token, "TRACE") {
            Some(Level::Debug)
        } else {
            None
        };
        if let Some(l) = level {
            return Some((l, start..i));
        }
    }
    None
}

fn eq_ignore_ascii(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dark_theme_has_palette() {
        let t = Theme::dark();
        assert!(!t.palette.is_empty());
        assert_eq!(t.rule_color(0), t.palette[0]);
        assert_eq!(t.rule_color(t.palette.len()), t.palette[0]);
    }

    #[test]
    fn signal_ansi16_uses_named_cyan_magenta() {
        let t = Theme::signal(ColorDepth::Ansi16, false);
        assert_eq!(t.accent, Color::Cyan);
        assert_eq!(t.secondary, Color::Magenta);
        assert_eq!(t.sev_crit, Color::LightRed);
        assert_eq!(t.sev_high, Color::Red);
        assert!(!t.depth.unicode_glyphs());
    }

    #[test]
    fn signal_truecolor_keeps_teal_violet() {
        let t = Theme::signal(ColorDepth::Truecolor, false);
        assert_eq!(t.accent, Color::Rgb(0x3E, 0xE0, 0xD8));
        assert_eq!(t.secondary, Color::Rgb(0x8B, 0x7C, 0xF6));
        assert!(t.depth.unicode_glyphs());
    }

    #[test]
    fn no_color_forces_mono() {
        // SAFETY: test process; we restore afterwards.
        let prev = env::var_os("NO_COLOR");
        unsafe { env::set_var("NO_COLOR", "1") };
        assert_eq!(resolve_color_depth(ColorMode::Auto), ColorDepth::Mono);
        match prev {
            Some(v) => unsafe { env::set_var("NO_COLOR", v) },
            None => unsafe { env::remove_var("NO_COLOR") },
        }
    }

    #[test]
    fn color_never_is_mono() {
        assert_eq!(resolve_color_depth(ColorMode::Never), ColorDepth::Mono);
    }

    #[test]
    fn light_theme_resolves() {
        let t = Theme::light();
        assert!(t.light);
        assert_eq!(t.accent, Color::Rgb(0x0E, 0x8C, 0x86));
        assert_eq!(t.secondary, Color::Rgb(0x5B, 0x4B, 0xD6));
    }

    /// Highlight colors are the user's bookkeeping; level tints and severities
    /// are the product's judgment. The two languages share a screen, so the
    /// slots handed out first must not echo a color that already means
    /// something — a first highlight in the ERROR coral, or a fourth in the
    /// accent, made the two ambiguous on first use.
    ///
    /// The last three slots are deliberately excluded: they *are* the semantic
    /// values, parked at the end where a user only reaches them after nine
    /// distinct highlights.
    #[test]
    fn first_rotation_slots_avoid_semantic_colors() {
        let t = Theme::dark();
        // Everything that can share a viewport with a highlight and already
        // carries meaning. `danger` and `marked` are absent on purpose: both are
        // browser-popup chrome, and the popup punches out the log entirely, so
        // they are never on screen beside a highlight.
        let reserved: Vec<(&str, Color)> = vec![
            ("accent", t.accent),
            ("secondary", t.secondary),
            ("level_error", t.level_error),
            ("level_warn", t.level_warn),
            ("level_info", t.level_info),
            ("level_debug", t.level_debug),
            ("Critical", t.severity_color(Severity::Critical)),
            ("High", t.severity_color(Severity::High)),
            ("Medium", t.severity_color(Severity::Medium)),
            ("Low", t.severity_color(Severity::Low)),
            ("Info", t.severity_color(Severity::Info)),
        ];
        let clean = t.palette.len() - 3;
        for i in 0..clean {
            let c = t.rule_color(i);
            for (name, r) in &reserved {
                assert_ne!(
                    c, *r,
                    "highlight slot {i} collides with the {name} color ({c:?}) — \
                     move it behind the {clean} clean slots"
                );
            }
        }
    }

    #[test]
    fn rotation_keeps_every_hue_and_repeats_only_after_a_full_cycle() {
        let t = Theme::dark();
        // Reordering must not drop or duplicate a hue: capacity and the
        // repeat-at-13 behaviour are unchanged.
        assert_eq!(t.palette.len(), 12);
        let mut seen = t.palette.clone();
        seen.sort_by_key(|c| format!("{c:?}"));
        seen.dedup();
        assert_eq!(seen.len(), 12, "rotation contains a duplicate hue");
        assert_eq!(t.rule_color(12), t.rule_color(0));
    }

    #[test]
    fn detect_level_uses_word_tokens() {
        assert_eq!(
            detect_level("2026 ERROR failed").map(|(l, _)| l),
            Some(Level::Error)
        );
        assert_eq!(
            detect_level("[WARN] slow").map(|(l, _)| l),
            Some(Level::Warn)
        );
        assert_eq!(
            detect_level("INFO ready").map(|(l, _)| l),
            Some(Level::Info)
        );
        assert_eq!(
            detect_level("DEBUG tick").map(|(l, _)| l),
            Some(Level::Debug)
        );
        assert_eq!(detect_level("no level here"), None);
        assert_eq!(detect_level("TERROR warningly"), None);
        // Leftmost token is the level column — later ERROR does not win.
        assert_eq!(detect_level("INFO then ERROR"), Some((Level::Info, 0..4)));
        // ALERT ranks with ERROR.
        assert_eq!(
            detect_level("ALERT blocked").map(|(l, _)| l),
            Some(Level::Error)
        );
        // Message keyword must not steal the INFO column tint.
        let line = "2026-07-22 10:01:04 INFO  User acknowledged alert, process terminated";
        let (level, range) = detect_level(line).unwrap();
        assert_eq!(level, Level::Info);
        assert_eq!(&line[range], "INFO");
    }

    #[test]
    fn level_token_range_covers_winning_token() {
        let (_, range) = detect_level("2026 ERROR failed").unwrap();
        assert_eq!(&"2026 ERROR failed"[range], "ERROR");
    }

    #[test]
    fn level_fg_picks_theme_colors() {
        let t = Theme::dark();
        assert_eq!(level_fg("ERROR boom", &t), t.level_error);
        assert_eq!(level_fg("WARN boom", &t), t.level_warn);
        assert_eq!(level_fg("hello", &t), t.text);
    }

    #[test]
    fn semantic_styles_keep_fills_dark_and_evidence_structural() {
        let t = Theme::dark();
        assert_eq!(t.severity_badge(Severity::High).fg, Some(t.match_fg));
        assert_eq!(
            t.severity_badge(Severity::High).bg,
            Some(t.severity_color(Severity::High))
        );
        assert_eq!(t.source_label().fg, Some(t.accent));
        assert_eq!(t.provenance().fg, Some(t.text_dim));
        assert_eq!(t.evidence().fg, Some(t.text));
    }

    #[test]
    fn status_tones_distinguish_existing_outcomes() {
        assert_eq!(Theme::status_tone("watchlist saved"), StatusTone::Success);
        assert_eq!(Theme::status_tone("scanning…"), StatusTone::Progress);
        assert_eq!(
            Theme::status_tone("watchlist reload failed"),
            StatusTone::Error
        );
        assert_eq!(Theme::status_tone("scan cancelled"), StatusTone::Warning);
        assert_eq!(Theme::status_tone("jumped to L12"), StatusTone::Success);
        assert_eq!(Theme::status_tone("filter cleared"), StatusTone::Neutral);
        assert_eq!(Theme::status_tone("no matches"), StatusTone::Error);
        assert_eq!(Theme::status_tone("match 1 of 5"), StatusTone::Neutral);
        assert_eq!(Theme::status_tone("occurrence 1 of 5"), StatusTone::Neutral);
    }

    #[test]
    fn panel_uses_plain_borders_and_padding() {
        let t = Theme::dark();
        let _ = t.panel(" title ", true);
    }

    #[test]
    fn glyph_fallbacks_switch_on_ansi16() {
        let fancy = Theme::signal(ColorDepth::Truecolor, false);
        let plain = Theme::signal(ColorDepth::Ansi16, false);
        assert_eq!(fancy.bar_filled(), "\u{25B0}");
        assert_eq!(plain.bar_filled(), "=");
        assert_eq!(plain.brand_mark(), "*");
    }
}
