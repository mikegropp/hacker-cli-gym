# Sample files

These synthetic files are for open-ended practice after a guided rep. Copy this
directory before experimenting if you want to restore it with one command.

Try exercises such as:

- count response codes in `logs/access.log` with `awk`, `sort`, and `uniq`;
- extract failed sign-ins from `logs/auth.log` with `grep` and `cut`;
- turn `data/people.csv` into aligned columns;
- compare enabled services in the configuration files;
- archive `projects/alpha`, calculate its SHA-256 digest, and unpack it elsewhere.

PowerShell practice ideas:

- import `data/people.csv`, filter by team, and select only names and cities;
- search `data/events.txt` with `Select-String`, then group matching lines;
- measure, sort, and deduplicate `data/hosts.txt` through the object pipeline;
- copy `projects/alpha`, archive it with `Compress-Archive`, and hash the ZIP;
- parse the key/value lines in `configs/app.conf` into useful objects.
