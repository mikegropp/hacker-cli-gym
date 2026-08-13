const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];

export default {
  uname: [
    {
      title: 'Print the kernel release', focus: 'uname -r reports the running kernel release string.',
      example: 'uname -r', example_output: '6.8.0-linux',
      task: 'Print only the kernel release.', solution: 'uname -r', checks: [{ type: 'stdout-nonempty', description: 'A kernel release was printed.' }],
    },
    {
      title: 'Print the machine architecture', focus: 'uname -m identifies the hardware architecture exposed to the operating system.',
      example: 'uname -m', example_output: 'x86_64',
      task: 'Print only the machine architecture.', solution: 'uname -m', checks: [{ type: 'stdout-regex', description: 'An architecture name was printed.', expected: '[A-Za-z0-9_.-]+' }],
    },
    {
      title: 'Print the GNU operating-system name', focus: 'GNU uname -o identifies the operating-system layer separately from the kernel name.',
      example: 'uname -o', example_output: 'GNU/Linux',
      task: 'Print only the operating-system name with uname -o.', solution: 'uname -o', checks: out('GNU/Linux'),
    },
    {
      title: 'Build a portable platform identifier', focus: 'Focused uname fields can be combined into a concise kernel-release/architecture identifier.',
      example: "printf '%s-%s\\n' \"$(uname -s)\" \"$(uname -m)\"", example_output: 'Linux-x86_64',
      task: 'Print kernel=<name> release=<release> arch=<machine> using uname substitutions.',
      solution: "printf 'kernel=%s release=%s arch=%s\\n' \"$(uname -s)\" \"$(uname -r)\" \"$(uname -m)\"", checks: [{ type: 'stdout-contains', description: 'The Linux kernel name was labeled.', expected: 'kernel=Linux' }, { type: 'stdout-contains', description: 'The architecture was labeled.', expected: 'arch=' }],
    },
  ],
  hostname: [
    {
      title: 'Print the short host name', focus: 'hostname -s omits any DNS domain suffix and prints the local short name.',
      example: 'hostname -s', example_output: 'training-box',
      task: 'Print the short hostname.', solution: 'hostname -s', checks: [{ type: 'stdout-nonempty', description: 'A short hostname was printed.' }],
    },
    {
      title: 'Resolve a host inventory name', focus: 'A short hostname can act as a lookup key in a reviewed host inventory without changing system resolver files.',
      example: "short=$(hostname -s); awk -v host=\"$short\" '$3==host {print $2}' hosts.txt", example_output: 'training-box.example.test',
      task: 'Use the current short hostname to print its fully qualified name from hosts.txt.',
      solution: "short=$(hostname -s); awk -v host=\"$short\" '$3==host {print $2}' hosts.txt",
      setup: ["short=$(hostname -s); printf '127.0.1.1 %s.example.test %s\\n' \"$short\" \"$short\" > hosts.txt"],
      checks: [{ type: 'stdout-contains', description: 'The inventory fully qualified name was printed.', expected: '.example.test' }],
    },
    {
      title: 'Resolve a host inventory address', focus: 'Matching the current hostname against a controlled inventory makes local address reporting deterministic and auditable.',
      example: "short=$(hostname -s); awk -v host=\"$short\" '$3==host {print $1}' hosts.txt", example_output: '127.0.1.1',
      task: 'Use the current short hostname to print its address from hosts.txt.',
      solution: "short=$(hostname -s); awk -v host=\"$short\" '$3==host {print $1}' hosts.txt",
      setup: ["short=$(hostname -s); printf '127.0.1.1 %s.example.test %s\\n' \"$short\" \"$short\" > hosts.txt"],
      checks: out('127.0.1.1'),
    },
    {
      title: 'Create a host identity record', focus: 'Combining hostname with a controlled inventory produces a small, reviewable identity record for logs and diagnostics.',
      example: "short=$(hostname -s); awk -v host=\"$short\" '$3==host {print \"host=\" $3 \" fqdn=\" $2 \" address=\" $1}' hosts.txt", example_output: 'host=training-box fqdn=training-box.example.test address=127.0.1.1',
      task: 'Print host=<short-name> fqdn=<inventory-name> address=<inventory-address>.',
      solution: "short=$(hostname -s); awk -v host=\"$short\" '$3==host {print \"host=\" $3 \" fqdn=\" $2 \" address=\" $1}' hosts.txt",
      setup: ["short=$(hostname -s); printf '127.0.1.1 %s.example.test %s\\n' \"$short\" \"$short\" > hosts.txt"],
      checks: [{ type: 'stdout-contains', description: 'The host label was included.', expected: 'host=' }, { type: 'stdout-contains', description: 'The inventory fully qualified name was labeled.', expected: ' fqdn=' }, { type: 'stdout-contains', description: 'The inventory address was labeled.', expected: ' address=127.0.1.1' }],
    },
  ],
  uptime: [
    {
      title: 'Print a human-friendly duration', focus: 'uptime -p presents elapsed uptime as readable units rather than a full status line.',
      example: 'uptime -p', example_output: 'up 2 hours, 4 minutes',
      task: 'Print the pretty uptime.', solution: 'uptime -p', checks: [{ type: 'stdout-contains', description: 'The readable uptime begins with up.', expected: 'up' }],
    },
    {
      title: 'Print the system start time', focus: 'uptime -s reports the timestamp when the current kernel session began.',
      example: 'uptime -s', example_output: '2026-01-02 08:00:00',
      task: 'Print the system startup timestamp.', solution: 'uptime -s', checks: [{ type: 'stdout-regex', description: 'A startup date and time were printed.', expected: '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' }],
    },
    {
      title: 'Extract the load averages', focus: 'The standard uptime line includes one-, five-, and fifteen-minute load averages after its final label.',
      example: "uptime | sed 's/.*load average: //'", example_output: '0.10, 0.15, 0.20',
      task: 'Print only the three load-average values from uptime.',
      solution: "uptime | sed 's/.*load average: //'", checks: [{ type: 'stdout-regex', description: 'Three load averages were printed.', expected: '[0-9., ]+' }],
    },
    {
      title: 'Build a boot-status record', focus: 'Pretty duration and startup time together provide both relative and absolute boot context.',
      example: "printf 'started=%s\\nuptime=%s\\n' \"$(uptime -s)\" \"$(uptime -p)\"", example_output: 'started=...\nuptime=up ...',
      task: 'Print started=<uptime -s> followed by duration=<uptime -p>.',
      solution: "printf 'started=%s\\nduration=%s\\n' \"$(uptime -s)\" \"$(uptime -p)\"", checks: [{ type: 'stdout-contains', description: 'The startup field was included.', expected: 'started=' }, { type: 'stdout-contains', description: 'The duration field was included.', expected: 'duration=up' }],
    },
  ],
  date: [
    {
      title: 'Choose a stable output format', focus: 'A leading + introduces a date format string with explicit fields.',
      example: "date '+%Y-%m-%d'", example_output: '2026-01-02',
      task: 'Print the current UTC date as YYYY-MM-DD.', solution: "date -u '+%Y-%m-%d'", checks: [{ type: 'stdout-regex', description: 'An ISO calendar date was printed.', expected: '[0-9]{4}-[0-9]{2}-[0-9]{2}' }],
    },
    {
      title: 'Parse a fixed date expression', focus: 'date -d parses a supplied date or relative expression without changing the system clock.',
      example: "date -d '2026-01-02 + 7 days' '+%F'", example_output: '2026-01-09',
      task: 'Print the date 30 days after 2026-04-01 as YYYY-MM-DD.',
      solution: "date -u -d '2026-04-01 + 30 days' '+%F'", checks: out('2026-05-01'),
    },
    {
      title: 'Format a file timestamp', focus: 'date -r reads a file modification time and formats it like any other timestamp.',
      example: "date -u -r artifact '+%FT%TZ'", example_output: '2026-01-02T03:04:00Z',
      task: 'Set artifact.txt to 2025-06-15 12:30 UTC, then print that modification time as an ISO UTC timestamp.',
      solution: "TZ=UTC touch -t 202506151230 artifact.txt && date -u -r artifact.txt '+%FT%TZ'", files: { 'artifact.txt': '' }, checks: out('2025-06-15T12:30:00Z'),
    },
    {
      title: 'Generate a deterministic range of dates', focus: 'A loop can pass relative offsets to date to build calendar-based filenames or schedules.',
      example: "for n in 0 1 2; do date -d \"2026-01-01 +$n day\" +%F; done", example_output: '2026-01-01\n2026-01-02\n2026-01-03',
      task: 'Print five dates beginning 2026-08-10, one day apart.',
      solution: 'for n in 0 1 2 3 4; do date -u -d "2026-08-10 +$n day" +%F; done', checks: out('2026-08-10\n2026-08-11\n2026-08-12\n2026-08-13\n2026-08-14'),
    },
  ],
  cal: [
    {
      title: 'Display a specific month', focus: 'cal accepts a numeric month and year so output is deterministic rather than tied to today.',
      example: 'cal 1 2026', example_output: 'January 2026 ...',
      task: 'Display the calendar for February 2028.', solution: 'cal 2 2028', checks: [{ type: 'stdout-contains', description: 'The requested month heading was printed.', expected: 'February 2028' }, { type: 'stdout-contains', description: 'Leap day 29 was present.', expected: '29' }],
    },
    {
      title: 'Show a whole year', focus: 'A single year operand prints all twelve monthly calendars.',
      example: 'cal 2026', example_output: '2026 ... January ... December',
      task: 'Display the full calendar for 2027.', solution: 'cal 2027', checks: [{ type: 'stdout-contains', description: 'The year heading was printed.', expected: '2027' }, { type: 'stdout-contains', description: 'December was included.', expected: 'December' }],
    },
    {
      title: 'Display Julian day numbers', focus: 'cal -j replaces day-of-month values with their numbered day of the year.',
      example: 'cal -j 3 2026', example_output: 'March 2026\nSu Mo Tu ...\n60 61 62 ...',
      task: 'Display March 2026 using Julian day-of-year numbers.',
      solution: 'cal -j 3 2026', checks: [{ type: 'stdout-contains', description: 'The March heading was printed.', expected: 'March 2026' }, { type: 'stdout-contains', description: 'March begins at day 60 in 2026.', expected: '60' }],
    },
    {
      title: 'Show a three-month planning window', focus: 'cal -3 displays the previous, selected, and next months as one planning view.',
      example: 'cal -3 6 2026', example_output: 'May 2026 June 2026 July 2026',
      task: 'Display May, June, and July 2026 using a three-month view centered on June.',
      solution: 'cal -3 6 2026', checks: [{ type: 'stdout-contains', description: 'May was included.', expected: 'May 2026' }, { type: 'stdout-contains', description: 'June was included.', expected: 'June 2026' }, { type: 'stdout-contains', description: 'July was included.', expected: 'July 2026' }],
    },
  ],
  env: [
    {
      title: 'Set a variable for one command', focus: 'env NAME=value applies a temporary environment assignment only to the child command.',
      example: 'env MODE=test printenv MODE', example_output: 'test',
      task: 'Run printenv APP_MODE with APP_MODE=practice supplied by env.',
      solution: 'env APP_MODE=practice printenv APP_MODE', checks: out('practice'),
    },
    {
      title: 'Remove one inherited variable', focus: 'env -u removes a selected name from the child environment without changing the parent shell.',
      example: 'TOKEN=x env -u TOKEN printenv TOKEN', example_output: '',
      task: 'Set SECRET=temporary, then use env -u to run a shell that prints absent when SECRET is unset.',
      solution: "SECRET=temporary env -u SECRET sh -c 'if [ -z \"${SECRET+x}\" ]; then echo absent; fi'", checks: out('absent'),
    },
    {
      title: 'Start with an empty environment', focus: 'env -i clears inherited variables so only explicitly provided values reach the child.',
      example: 'env -i MODE=test printenv', example_output: 'MODE=test',
      task: 'Start an empty environment containing only MODE=clean and REGION=west, then print it sorted.',
      solution: 'env -i MODE=clean REGION=west printenv | sort', checks: out('MODE=clean\nREGION=west'),
    },
    {
      title: 'Run a controlled build environment', focus: 'env can document and isolate all per-command settings for a repeatable workflow invocation.',
      example: "env MODE=prod REGION=west sh -c 'echo $MODE/$REGION'", example_output: 'prod/west',
      task: 'Run build.sh with MODE=release and TARGET=linux, saving its environment-derived output to build.txt.',
      solution: 'env MODE=release TARGET=linux sh build.sh > build.txt', files: { 'build.sh': '#!/bin/sh\nprintf "mode=%s target=%s\\n" "$MODE" "$TARGET"\n' }, checks: [{ type: 'file-content', description: 'The controlled build settings were used.', path: 'build.txt', expected: 'mode=release target=linux\n' }],
    },
  ],
  printenv: [
    {
      title: 'Inspect PATH one directory per line', focus: 'printenv emits the raw PATH value, which tr can split into its ordered search directories.',
      example: "printenv PATH | tr ':' '\\n'", example_output: '/usr/local/sbin\n/usr/local/bin\n...',
      task: 'Print the PATH search directories one per line.', solution: "printenv PATH | tr ':' '\\n'", checks: [{ type: 'stdout-contains', description: 'The standard binary directory was included.', expected: '/usr/bin' }],
    },
    {
      title: 'Print several named values', focus: 'printenv accepts multiple names and prints each value in operand order.',
      example: 'printenv HOME LANG', example_output: '/work\nC.UTF-8',
      task: 'Print HOME, LANG, and TERM in that order.', solution: 'printenv HOME LANG TERM', checks: out('{{workspace}}\nC.UTF-8\nxterm-256color'),
    },
    {
      title: 'Test whether a variable is exported', focus: 'printenv returns a nonzero status for a name absent from the process environment.',
      example: 'printenv MISSING || echo not-exported', example_output: 'not-exported',
      task: 'Use printenv to check GYM_MISSING and print not-exported when it is absent.',
      solution: 'printenv GYM_MISSING >/dev/null || echo not-exported', checks: out('not-exported'),
    },
    {
      title: 'Create a selected environment report', focus: 'A loop around printenv can label a reviewed subset instead of exposing an entire environment dump.',
      example: "for n in HOME LANG; do printf '%s=%s\\n' \"$n\" \"$(printenv \"$n\")\"; done", example_output: 'HOME=/work\nLANG=C.UTF-8',
      task: 'Print labeled HOME, LANG, and TERM values in that order.',
      solution: "for name in HOME LANG TERM; do printf '%s=%s\\n' \"$name\" \"$(printenv \"$name\")\"; done", checks: out('HOME={{workspace}}\nLANG=C.UTF-8\nTERM=xterm-256color'),
    },
  ],
  df: [
    {
      title: 'Show human-readable filesystem sizes', focus: 'df -h scales block counts into readable units such as MiB and GiB.',
      example: 'df -h /work', example_output: 'Filesystem Size Used Avail Use% Mounted on ...',
      task: 'Show human-readable space information for the workspace filesystem.',
      solution: 'df -h /work', checks: [{ type: 'stdout-contains', description: 'The size heading was printed.', expected: 'Size' }, { type: 'stdout-contains', description: 'The available-space heading was printed.', expected: 'Avail' }],
    },
    {
      title: 'Inspect inode availability', focus: 'df -i reports inode totals and use rather than storage blocks.',
      example: 'df -i /work', example_output: 'Filesystem Inodes IUsed IFree IUse% Mounted on ...',
      task: 'Show inode usage for /work.', solution: 'df -i /work', checks: [{ type: 'stdout-contains', description: 'The inode heading was printed.', expected: 'Inodes' }, { type: 'stdout-contains', description: 'Free inodes were reported.', expected: 'IFree' }],
    },
    {
      title: 'Select exact output columns', focus: 'df --output creates a focused filesystem report with only named fields.',
      example: 'df --output=source,size,used,avail,pcent,target /work', example_output: 'Filesystem 1K-blocks Used Available Use% Mounted on',
      task: 'Print source, filesystem type, size, available space, use percent, and target for /work.',
      solution: 'df --output=source,fstype,size,avail,pcent,target /work', checks: [{ type: 'stdout-contains', description: 'The filesystem type heading was included.', expected: 'Type' }, { type: 'stdout-contains', description: 'The use percentage heading was included.', expected: 'Use%' }],
    },
    {
      title: 'Emit a compact capacity record', focus: 'The field-focused df output can feed awk to create a one-line capacity record for monitoring.',
      example: "df -P /work | awk 'NR==2 {print \"used=\" $5}'", example_output: 'used=42%',
      task: 'Use POSIX df output and awk to print filesystem=<source> used=<percent> mount=<target> for /work.',
      solution: "df -P /work | awk 'NR==2 {print \"filesystem=\" $1 \" used=\" $5 \" mount=\" $6}'", checks: [{ type: 'stdout-contains', description: 'The filesystem was labeled.', expected: 'filesystem=' }, { type: 'stdout-contains', description: 'The used percentage was labeled.', expected: ' used=' }, { type: 'stdout-contains', description: 'The mount was labeled.', expected: ' mount=' }],
    },
  ],
  du: [
    {
      title: 'Summarize one directory', focus: 'du -s produces one total instead of a row for every descendant; -h scales it readably.',
      example: 'du -sh project', example_output: '24K project',
      task: 'Print one human-readable size summary for project.',
      solution: 'du -sh project', files: { 'project/a.txt': 'alpha\n', 'project/nested/b.txt': 'beta\n' }, checks: [{ type: 'stdout-contains', description: 'The project path was labeled.', expected: 'project' }],
    },
    {
      title: 'Show one directory depth', focus: 'du --max-depth=1 shows direct child totals plus the overall directory total.',
      example: 'du -h --max-depth=1 project', example_output: '... project/src\n... project/tests\n... project',
      task: 'Show human-readable totals one level below workspace-data.',
      solution: 'du -h --max-depth=1 workspace-data', files: { 'workspace-data/logs/a.log': 'a\n', 'workspace-data/cache/b.dat': 'b\n', 'workspace-data/docs/c.txt': 'c\n' }, checks: [{ type: 'stdout-contains', description: 'The logs child was included.', expected: 'workspace-data/logs' }, { type: 'stdout-contains', description: 'The cache child was included.', expected: 'workspace-data/cache' }],
    },
    {
      title: 'Measure apparent file size', focus: '--apparent-size reports logical bytes rather than allocated disk blocks.',
      example: 'du -b file.txt', example_output: '10 file.txt',
      task: 'Print the apparent byte size of payload.txt.', solution: 'du -b payload.txt', files: { 'payload.txt': '1234567890' }, checks: out('10\tpayload.txt'),
    },
    {
      title: 'Rank child directories by size', focus: 'Byte-based du output can be sorted numerically to identify the largest directory in a small tree.',
      example: 'du -sb data/* | sort -nr', example_output: '100 data/large\n10 data/small',
      task: 'Print apparent byte totals for each child of data, largest first.',
      solution: 'du -sb data/* | sort -nr', files: { 'data/small/a.txt': '1', 'data/medium/b.txt': '12345', 'data/large/c.txt': '12345678901234567890' }, checks: [{ type: 'stdout-contains', description: 'The large directory was included.', expected: 'data/large' }, { type: 'stdout-contains', description: 'The small directory was included.', expected: 'data/small' }],
    },
  ],
  free: [
    {
      title: 'Show memory in mebibytes', focus: 'free -m fixes every reported quantity to MiB for easy numeric comparison.',
      example: 'free -m', example_output: 'Mem: 7870 ...',
      task: 'Print memory statistics in mebibytes.', solution: 'free -m', checks: [{ type: 'stdout-contains', description: 'The memory row was printed.', expected: 'Mem:' }, { type: 'stdout-contains', description: 'The swap row was printed.', expected: 'Swap:' }],
    },
    {
      title: 'Include a total row', focus: 'free -t adds an aggregate total row below memory and swap.',
      example: 'free -t', example_output: 'Total: ...',
      task: 'Print memory statistics with a total row.', solution: 'free -t', checks: [{ type: 'stdout-contains', description: 'The total row was included.', expected: 'Total:' }],
    },
    {
      title: 'Show wide memory fields', focus: 'free -w separates buffers and cache into distinct columns for a more detailed view.',
      example: 'free -w', example_output: 'total used free shared buffers cache available',
      task: 'Print wide-format memory statistics.', solution: 'free -w', checks: [{ type: 'stdout-contains', description: 'The buffers column was shown.', expected: 'buffers' }, { type: 'stdout-contains', description: 'The cache column was shown.', expected: 'cache' }],
    },
    {
      title: 'Extract an available-memory metric', focus: 'The stable free column layout can feed awk to isolate one metric for a health record.',
      example: "free -b | awk '/^Mem:/ {print \"available_bytes=\" $7}'", example_output: 'available_bytes=123456789',
      task: 'Use free -b and awk to print available_bytes=<value>.',
      solution: "free -b | awk '/^Mem:/ {print \"available_bytes=\" $7}'", checks: [{ type: 'stdout-regex', description: 'Available bytes were emitted as a numeric metric.', expected: 'available_bytes=[0-9]+' }],
    },
  ],
};
