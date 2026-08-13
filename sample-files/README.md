# Sample files

These synthetic files are for open-ended practice after a guided rep. Run
`./gym samples` from the repository to copy a fresh set to `/work/samples` and
open a raw Bash session.

Try exercises such as:

- count response codes in `logs/access.log` with `awk`, `sort`, and `uniq`;
- extract failed sign-ins from `logs/auth.log` with `grep`, `cut`, or `sed`;
- turn `data/people.csv` into aligned columns;
- query enabled services and count their ports in `data/services.json` with `jq`;
- compare enabled services in the configuration files;
- review and source `configs/lab.env`, then call the function in `scripts/report.sh`;
- archive `projects/alpha`, calculate its SHA-256 digest, and unpack it;
- combine several steps into a pipeline that produces a short report.
