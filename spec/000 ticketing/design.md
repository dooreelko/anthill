# Ticketing within repo

Design specifications and ticketing integrated in the project's repository.

## Idea

1. Have new units of work (UOW) defined (description, design, tasks, etc) within repo
2. In a machine-readable form (markdown)
3. Enforce that commits are attributed to a concrete UOW
4. Use that to (at least partially) generate changelog (commits are too technical for that)

## Design

- A special directory "spec" in the repo's root
- A subdirectory per "story" (collection of UOW) with an optional numeric prefix for lexicographic ordering 
    - Single-word name for the story/directory.
    - Format `[XXX] storyname`. `XXX` is an optional 3-digit number.
- Branching naming convention `(feature|fix)/<storyname>[/<taskname>]`
    - `storyname` without numeric prefix
- `design.md` file with at lease these sections (things in `<>` are free text):
    - <Heading 1>. `<Story's title>`.
    - <Paragraph>. `<Optional one paragraph to include in the changelog>`.
    - <Heading 2>. `Idea`. Text.
    - <Heading 2>. `Design`. Text.
    - <Heading 2>. `Tasks`. Checkbox list with items in form
    `- [ ] <taskname>. <optional task descripton text>`
- A git hook that rejects commit if branch is not following the convention.
- A git hook that auto-inserts story+task into commit message.

## Tasks
- [x] design
- [x] husky. Reject commit if branch is not correctly named. Auto-prepend OUW ID `[story|task]` into commit message. 
- [x] changelog