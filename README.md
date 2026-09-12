# Knowledge Base

Personal knowledge notes stored as Markdown files.

## Layout

- `notes/00-inbox/`: quick captures awaiting organization.
- `notes/10-projects/`: time-bounded work with a concrete outcome.
- `notes/20-areas/`: ongoing responsibilities and areas of interest.
- `notes/30-resources/`: reference material, concepts, and learning notes.
- `notes/40-archive/`: inactive or completed material kept for reference.
- `templates/`: reusable Markdown templates.
- `scripts/`: commands for creating notes and rebuilding the index.

Add folders beneath any top-level section when the topic needs more structure. The generated index follows that hierarchy automatically.

## Add a note

From PowerShell at the repository root:

```powershell
.\scripts\new-note.ps1 -Path "20-areas/development" -Title "Git conventions"
```

The command creates `notes/20-areas/development/git-conventions.md` from the standard template and regenerates `INDEX.md`. Use `-Open` to open the new file in the default Markdown editor.

## Update the index

Run this after moving, renaming, or manually adding Markdown files:

```powershell
.\scripts\update-index.ps1
```

`INDEX.md` is generated from the directory structure and should not be edited directly.
