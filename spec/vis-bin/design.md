# Vis binaries using bin-dir

That was a neat idea, but seems like wile npm and yarn respect `directories.bin`
when run directly, lerna's on-the-fly modification of package.json somehow
breaks it.

Back to explicit `bin` entries.
