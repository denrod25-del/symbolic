# 🧠 Second Brain — an Obsidian vault

A ready-to-use **second brain**: an [Obsidian](https://obsidian.md) vault for capturing, organizing, and connecting what you learn and work on. It combines **PARA** (organize by actionability) with a lightweight **Zettelkasten** note style and **Maps of Content** for navigation.

## Open it
1. Install [Obsidian](https://obsidian.md/download).
2. **Open folder as vault** → select this `second-brain/` folder.
3. Open **[[Home]]** (`06 Maps of Content/Home.md`) — that's your dashboard. Pin it.
4. Read **How to use this vault** for the 2-minute workflow.

## Structure
```
second-brain/
├── 00 Inbox/              # capture everything here first, sort later
├── 01 Projects/           # goals with a deadline (PARA)
├── 02 Areas/              # ongoing responsibilities (PARA)
├── 03 Resources/          # topics & reference material (PARA)
├── 04 Archive/            # finished / inactive items (PARA)
├── 05 Templates/          # note templates (core Templates plugin)
├── 06 Maps of Content/    # Home dashboard + curated index hubs
├── 99 Attachments/        # images & files
├── Daily/                 # daily notes
└── .obsidian/             # vault config (templates, daily notes pre-wired)
```

## What's pre-configured
- **Templates** plugin → points at `05 Templates` (Daily, Project, Area, Resource, Literature, Permanent, Meeting, MOC).
- **Daily notes** plugin → notes land in `Daily/`, using the Daily Note template.
- New notes default to `00 Inbox`; attachments go to `99 Attachments`.

## The daily habit
**Capture** into the Inbox → **process** weekly into P/A/R → **link** every note to at least one other → **review** weekly and archive what's done.

> The templates use Obsidian's core `{{date}}` / `{{title}}` syntax. For dynamic dates, scripting, and richer templating later, install the **Templater** community plugin.
