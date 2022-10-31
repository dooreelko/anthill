# Ticketing within repo

Design specifications and ticketing integrated in the project's repository.

## Idea

1. Have new units of work (UOW) defined (description, design, tasks, etc) within repo
2. In a machine-readable form (markdown)
3. Enforce that commits are attributed to a concrete UOW
4. Use that to (at least partially) generate changelog (commits are too technical for that)

### Rationale.

Documentation is often an afterthought or at least a last task during development.

Even scrum manifesto reasonably defines
> Working software over comprehensive documentation.

On the other hand, a scrum's user story, for example, is already a form of documentation. At least of the intent of a feature.

And as we know, a bad documentation is better than none at all.

Traditionally, an external system is used, be it Jira, GitHub issues or something else. Often in a conjunction with a documenting system (Confluence, Sharepoint etc).
This works, but creates a disconnect between the implementation and the documentation, often resulting in the documentation becoming outdated.

By keeping ticketing and design docs in the repository, the documentation will not magically write itself, but at least the number of "sources of truth" are reduced. All the while, if one chooses to still use GitHub issues, Sharepoint etc, those systems can be automatically synchronised from within the repository. Doing that in the opposite direction is significantly harder.

Also, since one anyway needs to plan the work, this allows for a natural "write the ticket with documentation in mind" approach.

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
    - <Heading 2>. `Idea`. Optional. Text.
    - <Heading 2>. `Design`. Optional. Text.
    - <Heading 2>. `Tasks`. Optional. Checkbox list with items in form
    `- [ ] <taskname>. <optional task descripton text>`
- A git hook that rejects commit if branch is not following the convention.
- A git hook that auto-inserts story+task into commit message.

## Tasks
- [x] design
- [x] husky. Reject commit if branch is not correctly named. Auto-prepend UOW ID `[story|task]` into commit message. 
- [x] changelog