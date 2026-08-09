const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];

export default {
  pwd: [
    {
      title: 'Anchor a nested workflow',
      focus: 'Run pwd after changing directories to verify exactly where a relative operation will begin.',
      example: 'cd projects && pwd', example_output: '/work/projects',
      task: 'Enter reports/daily and print its absolute path.',
      solution: 'cd reports/daily && pwd', directories: ['reports/daily'],
      checks: out('{{workspace}}/reports/daily'),
    },
    {
      title: 'Resolve the physical directory',
      focus: 'The -P option follows symbolic links and prints the physical directory on disk.',
      example: 'cd current && pwd -P', example_output: '/work/releases/2026',
      task: 'Enter the current symlink and print the physical release directory.',
      solution: 'cd current && pwd -P', directories: ['releases/2026'], symlinks: { current: 'releases/2026' },
      checks: out('{{workspace}}/releases/2026'),
    },
    {
      title: 'Compare logical and physical paths',
      focus: 'pwd -L preserves the logical symlink path, while pwd -P reveals its physical target.',
      example: "cd live && printf '%s\\n%s\\n' \"$(pwd -L)\" \"$(pwd -P)\"", example_output: '/work/live\n/work/releases/v2',
      task: 'Enter live and print its logical path followed by its physical path.',
      solution: "cd live && printf '%s\\n%s\\n' \"$(pwd -L)\" \"$(pwd -P)\"", directories: ['releases/v2'], symlinks: { live: 'releases/v2' },
      checks: out('{{workspace}}/live\n{{workspace}}/releases/v2'),
    },
    {
      title: 'Record a canonical deployment path',
      focus: 'Command substitution lets a script capture pwd -P as reliable workflow data.',
      example: "cd active && printf 'root=%s\\n' \"$(pwd -P)\" > /work/location.env", example_output: '',
      task: 'Enter active and write root=<physical path> to location.env in the workspace root.',
      solution: "cd active && printf 'root=%s\\n' \"$(pwd -P)\" > /work/location.env", directories: ['deployments/blue'], symlinks: { active: 'deployments/blue' },
      checks: [{ type: 'file-content', description: 'The canonical deployment root was recorded.', path: 'location.env', expected: 'root={{workspace}}/deployments/blue\n' }],
    },
  ],
  ls: [
    {
      title: 'Include hidden entries', focus: 'The -A option includes hidden names but omits the special . and .. entries.',
      example: 'ls -A', example_output: '.env\nnotes.txt',
      task: 'List every name in the workspace, including .env, one per line.',
      solution: 'ls -1A', files: { '.env': 'MODE=practice\n', 'notes.txt': 'ready\n' },
      checks: [{ type: 'stdout-unordered-lines', description: 'Both visible and hidden files were listed.', expected: '.env\nnotes.txt' }],
    },
    {
      title: 'Select entries with a wildcard', focus: 'Shell wildcards can narrow ls to names that match a useful filename pattern.',
      example: 'ls -1 *.log', example_output: 'app.log\naudit.log',
      task: 'Print only the .log filenames, one per line.',
      solution: 'ls -1 *.log', files: { 'app.log': 'a\n', 'audit.log': 'b\n', 'notes.txt': 'c\n' },
      checks: [{ type: 'stdout-unordered-lines', description: 'Only log files were listed.', expected: 'app.log\naudit.log' }],
    },
    {
      title: 'Sort files by size', focus: 'Combining -S with -1 orders entries from largest to smallest in a script-friendly list.',
      example: 'ls -1S *.dat', example_output: 'large.dat\nsmall.dat',
      task: 'List the three .dat files from largest to smallest.',
      solution: 'ls -1S *.dat', files: { 'tiny.dat': '1', 'medium.dat': '12345', 'large.dat': '1234567890' },
      checks: out('large.dat\nmedium.dat\ntiny.dat'),
    },
    {
      title: 'Inventory a project tree', focus: 'Recursive listing with -R provides a quick inventory across nested directories.',
      example: 'ls -R project', example_output: 'project:\nREADME.md  src\n\nproject/src:\nmain.sh',
      task: 'Recursively list project and prove the output includes README.md, src, and main.sh.',
      solution: 'ls -R project', files: { 'project/README.md': 'demo\n', 'project/src/main.sh': '#!/bin/sh\n' },
      checks: [
        { type: 'stdout-contains', description: 'The root file was listed.', expected: 'README.md' },
        { type: 'stdout-contains', description: 'The source directory was listed.', expected: 'src' },
        { type: 'stdout-contains', description: 'The nested script was listed.', expected: 'main.sh' },
      ],
    },
  ],
  cd: [
    {
      title: 'Navigate a nested relative path', focus: 'A multi-component relative path moves through several levels in one command.',
      example: 'cd projects/alpha', example_output: '',
      task: 'Change into clients/acme/reports and print the resulting path.',
      solution: 'cd clients/acme/reports && pwd', directories: ['clients/acme/reports'], checks: out('{{workspace}}/clients/acme/reports'),
    },
    {
      title: 'Move to a parent directory', focus: 'The .. component moves to the parent without requiring its name.',
      example: 'cd projects/alpha && cd .. && pwd', example_output: '/work/projects',
      task: 'Enter archive/2026, move back to archive with cd .., and print the path.',
      solution: 'cd archive/2026 && cd .. && pwd', directories: ['archive/2026'], checks: out('{{workspace}}/archive'),
    },
    {
      title: 'Return to the previous directory', focus: 'cd - switches to OLDPWD, which is useful when alternating between two working directories.',
      example: 'cd one; cd ../two; cd -', example_output: '/work/one',
      task: 'Visit blue, then green, then use cd - to return to blue and print the final path only.',
      solution: 'cd blue && cd ../green && cd - >/dev/null && pwd', directories: ['blue', 'green'], checks: out('{{workspace}}/blue'),
    },
    {
      title: 'Enter a symlink target physically', focus: 'cd -P resolves symbolic links while changing directory so later relative paths use the physical location.',
      example: 'cd -P current && pwd', example_output: '/work/releases/stable',
      task: 'Use cd -P on current and print the resulting physical directory.',
      solution: 'cd -P current && pwd', directories: ['releases/stable'], symlinks: { current: 'releases/stable' }, checks: out('{{workspace}}/releases/stable'),
    },
  ],
  basename: [
    {
      title: 'Remove a known suffix', focus: 'A suffix argument removes a known extension from the final path component.',
      example: 'basename reports/daily.csv .csv', example_output: 'daily',
      task: 'Print the filename report without the .json suffix from exports/report.json.',
      solution: 'basename exports/report.json .json', files: { 'exports/report.json': '{}\n' }, checks: out('report'),
    },
    {
      title: 'Extract several filenames', focus: 'The -a option accepts multiple paths and prints one basename for each.',
      example: 'basename -a one/a.txt two/b.txt', example_output: 'a.txt\nb.txt',
      task: 'Print the filenames from src/app.js, config/app.ini, and docs/app.md.',
      solution: 'basename -a src/app.js config/app.ini docs/app.md', files: { 'src/app.js': '', 'config/app.ini': '', 'docs/app.md': '' }, checks: out('app.js\napp.ini\napp.md'),
    },
    {
      title: 'Strip one suffix from a batch', focus: 'Combining -a and -s removes the same suffix from every supplied path.',
      example: 'basename -a -s .log logs/app.log logs/auth.log', example_output: 'app\nauth',
      task: 'Print api, worker, and scheduler from their .service paths.',
      solution: 'basename -a -s .service units/api.service units/worker.service units/scheduler.service', files: { 'units/api.service': '', 'units/worker.service': '', 'units/scheduler.service': '' }, checks: out('api\nworker\nscheduler'),
    },
    {
      title: 'Label files from a path stream', focus: 'xargs can apply basename repeatedly when paths arrive as a stream from another command.',
      example: "printf '%s\\n' logs/a.log logs/b.log | xargs -n1 basename -s .log", example_output: 'a\nb',
      task: 'Read paths.txt and print each filename without its .bak suffix.',
      solution: 'xargs -n1 basename -s .bak < paths.txt', files: { 'paths.txt': 'archive/db.bak\narchive/web.bak\narchive/mail.bak\n' }, checks: out('db\nweb\nmail'),
    },
  ],
  dirname: [
    {
      title: 'Find a parent path', focus: 'dirname removes the final component even when the path has several nested levels.',
      example: 'dirname app/config/settings.ini', example_output: 'app/config',
      task: 'Print the parent path of clients/acme/reports/daily.csv.',
      solution: 'dirname clients/acme/reports/daily.csv', files: { 'clients/acme/reports/daily.csv': '' }, checks: out('clients/acme/reports'),
    },
    {
      title: 'Process multiple paths', focus: 'GNU dirname accepts several paths and emits one parent for each in input order.',
      example: 'dirname one/a.txt two/b.txt', example_output: 'one\ntwo',
      task: 'Print the parents of src/app.js, tests/app.test.js, and docs/readme.md.',
      solution: 'dirname src/app.js tests/app.test.js docs/readme.md', files: { 'src/app.js': '', 'tests/app.test.js': '', 'docs/readme.md': '' }, checks: out('src\ntests\ndocs'),
    },
    {
      title: 'Climb from a file to a project root', focus: 'Applying dirname more than once walks upward through a path string without touching the filesystem.',
      example: 'dirname "$(dirname project/src/main.c)"', example_output: 'project',
      task: 'Starting with services/api/config/app.ini, print the services/api project directory.',
      solution: 'dirname "$(dirname services/api/config/app.ini)"', files: { 'services/api/config/app.ini': '' }, checks: out('services/api'),
    },
    {
      title: 'Summarize unique source directories', focus: 'dirname composes naturally with sort and uniq to summarize which directories contain a set of files.',
      example: "xargs dirname < paths.txt | sort -u", example_output: 'app\nlib',
      task: 'Read paths.txt and print the unique parent directories in sorted order.',
      solution: 'xargs dirname < paths.txt | sort -u', files: { 'paths.txt': 'src/app.js\nsrc/util.js\ntests/app.test.js\ndocs/readme.md\n' }, checks: out('docs\nsrc\ntests'),
    },
  ],
  realpath: [
    {
      title: 'Normalize relative components', focus: 'realpath removes . and .. components while resolving an existing path.',
      example: 'realpath project/./src/../README.md', example_output: '/work/project/README.md',
      task: 'Resolve app/./config/../README.md to its canonical absolute path.',
      solution: 'realpath app/./config/../README.md', files: { 'app/README.md': 'app\n' }, directories: ['app/config'], checks: out('{{workspace}}/app/README.md'),
    },
    {
      title: 'Print a path relative to a base', focus: 'The --relative-to option converts a canonical path into a path relative to a chosen directory.',
      example: 'realpath --relative-to=project project/src/main.sh', example_output: 'src/main.sh',
      task: 'Print releases/2026/app.conf relative to releases.',
      solution: 'realpath --relative-to=releases releases/2026/app.conf', files: { 'releases/2026/app.conf': 'mode=practice\n' }, checks: out('2026/app.conf'),
    },
    {
      title: 'Resolve a missing destination safely', focus: 'realpath -m canonicalizes every component even when the final path does not exist yet.',
      example: 'realpath -m output/../build/result.txt', example_output: '/work/build/result.txt',
      task: 'Canonicalize staging/../artifacts/new.tar even though new.tar does not exist.',
      solution: 'realpath -m staging/../artifacts/new.tar', directories: ['staging', 'artifacts'], checks: out('{{workspace}}/artifacts/new.tar'),
    },
    {
      title: 'Trace a deployment symlink chain', focus: 'realpath follows every symbolic link in a chain to identify the actual versioned file.',
      example: 'realpath entry.conf', example_output: '/work/releases/2026/config/app.conf',
      task: 'Resolve entry.conf through all three symbolic links to the actual app.conf file.',
      solution: 'realpath entry.conf', files: { 'vault/releases/2026/config/app.conf': 'mode=practice\n' }, symlinks: { 'vault/current': 'releases/2026', active: 'vault/current', 'entry.conf': 'active/config/app.conf' }, checks: out('{{workspace}}/vault/releases/2026/config/app.conf'),
    },
  ],
  which: [
    {
      title: 'Locate several required tools', focus: 'which accepts multiple command names, making it useful for quick prerequisite checks.',
      example: 'which grep sed', example_output: '/usr/bin/grep\n/usr/bin/sed',
      task: 'Print the selected executable paths for grep and awk.',
      solution: 'which grep awk', checks: out('/usr/bin/grep\n/usr/bin/awk'),
    },
    {
      title: 'Test whether a command is available', focus: 'The exit status from which is useful in a conditional even when its normal output is suppressed.',
      example: 'if which jq >/dev/null; then echo ready; fi', example_output: 'ready',
      task: 'Use which in a conditional and print available if rsync can be found.',
      solution: 'if which rsync >/dev/null; then echo available; fi', checks: out('available'),
    },
    {
      title: 'Inspect every PATH match', focus: 'The -a option prints every matching executable instead of stopping at the first.',
      example: 'which -a sh', example_output: '/usr/bin/sh\n/bin/sh',
      task: 'Use which -a to print every PATH match for bash.',
      solution: 'which -a bash', checks: [{ type: 'stdout-contains', description: 'At least the selected bash path was printed.', expected: '/usr/bin/bash' }],
    },
    {
      title: 'Build a prerequisite report', focus: 'A small loop can pair each required command name with the executable selected by PATH.',
      example: "for tool in grep sed; do printf '%s=%s\\n' \"$tool\" \"$(which \"$tool\")\"; done", example_output: 'grep=/usr/bin/grep\nsed=/usr/bin/sed',
      task: 'Print tool=path lines for jq, curl, and tar in that order.',
      solution: "for tool in jq curl tar; do printf '%s=%s\\n' \"$tool\" \"$(which \"$tool\")\"; done", checks: out('jq=/usr/bin/jq\ncurl=/usr/bin/curl\ntar=/usr/bin/tar'),
    },
  ],
  whereis: [
    {
      title: 'Find only a command binary', focus: 'The -b option limits whereis output to binary locations.',
      example: 'whereis -b grep', example_output: 'grep: /usr/bin/grep',
      task: 'Use whereis -b to locate the sed binary.',
      solution: 'whereis -b sed', checks: [{ type: 'stdout-contains', description: 'The sed binary location was included.', expected: '/usr/bin/sed' }],
    },
    {
      title: 'Search for several commands', focus: 'whereis can report locations for multiple names in one invocation.',
      example: 'whereis -b grep awk', example_output: 'grep: /usr/bin/grep\nawk: /usr/bin/awk',
      task: 'Print binary-location reports for bash and tar.',
      solution: 'whereis -b bash tar', checks: [
        { type: 'stdout-contains', description: 'The bash report was printed.', expected: 'bash:' },
        { type: 'stdout-contains', description: 'The tar report was printed.', expected: 'tar:' },
      ],
    },
    {
      title: 'Extract a binary path from the report', focus: 'Text tools can isolate the location field from whereis output for later scripting.',
      example: "whereis -b jq | awk '{print $2}'", example_output: '/usr/bin/jq',
      task: 'Print only the first binary path reported for curl.',
      solution: "whereis -b curl | awk '{print $2}'", checks: out('/usr/bin/curl'),
    },
    {
      title: 'Audit tool locations', focus: 'Combining whereis with a loop creates a compact inventory without searching the entire filesystem.',
      example: "for t in jq tar; do whereis -b \"$t\"; done", example_output: 'jq: /usr/bin/jq\ntar: /usr/bin/tar',
      task: 'Produce whereis -b reports for ssh, scp, and rsync in that order.',
      solution: 'for tool in ssh scp rsync; do whereis -b "$tool"; done', checks: [
        { type: 'stdout-contains', description: 'The ssh inventory entry was printed.', expected: 'ssh:' },
        { type: 'stdout-contains', description: 'The scp inventory entry was printed.', expected: 'scp:' },
        { type: 'stdout-contains', description: 'The rsync inventory entry was printed.', expected: 'rsync:' },
      ],
    },
  ],
  type: [
    {
      title: 'Identify a shell builtin', focus: 'type recognizes shell builtins that do not have a standalone executable file.',
      example: 'type cd', example_output: 'cd is a shell builtin',
      task: 'Use type to identify pwd in this Bash session.',
      solution: 'type pwd', checks: [{ type: 'stdout-contains', description: 'pwd was identified as a shell builtin.', expected: 'shell builtin' }],
    },
    {
      title: 'Print only the command category', focus: 'type -t emits a compact category such as builtin, file, alias, or function.',
      example: 'type -t printf', example_output: 'builtin',
      task: 'Print only the type category for grep.',
      solution: 'type -t grep', checks: out('file'),
    },
    {
      title: 'Show every command resolution', focus: 'type -a reveals all matching builtins and executable files in command-resolution order.',
      example: 'type -a pwd', example_output: 'pwd is a shell builtin\npwd is /usr/bin/pwd',
      task: 'Use type -a to show every available implementation of printf.',
      solution: 'type -a printf', checks: [
        { type: 'stdout-contains', description: 'The builtin implementation was shown.', expected: 'shell builtin' },
        { type: 'stdout-contains', description: 'An executable implementation was shown.', expected: '/usr/bin/printf' },
      ],
    },
    {
      title: 'Classify a mixed command set', focus: 'A loop around type -t can document whether dependencies are builtins or external files.',
      example: "for c in cd grep; do printf '%s=%s\\n' \"$c\" \"$(type -t \"$c\")\"; done", example_output: 'cd=builtin\ngrep=file',
      task: 'Print name=category lines for cd, echo, and sed in that order.',
      solution: "for c in cd echo sed; do printf '%s=%s\\n' \"$c\" \"$(type -t \"$c\")\"; done", checks: out('cd=builtin\necho=builtin\nsed=file'),
    },
  ],
  man: [
    {
      title: 'Identify the installed man version', focus: 'The --version output confirms which man implementation and documentation behavior are available.',
      example: 'man --version | head -n 1', example_output: 'man 2.11.2',
      task: 'Print only the first line of man --version.',
      solution: 'man --version | head -n 1', checks: [{ type: 'stdout-contains', description: 'The man version line was printed.', expected: 'man' }],
    },
    {
      title: 'Render a local manual page', focus: 'man -l reads a page file directly, which is useful for project documentation not installed system-wide.',
      example: 'man -l tool.1', example_output: 'TOOL(1) ...',
      task: 'Render the local gymtool.1 page and print it without an interactive pager.',
      solution: 'MANPAGER=cat man -l gymtool.1', files: { 'gymtool.1': '.TH GYMTOOL 1\n.SH NAME\ngymtool \\- practice helper\n.SH SYNOPSIS\ngymtool [OPTIONS]\n' },
      checks: [{ type: 'stdout-contains', description: 'The local page name section was rendered.', expected: 'practice helper' }],
    },
    {
      title: 'Extract a manual-page section', focus: 'A noninteractive pager lets text tools search rendered manual content in scripts.',
      example: "MANPAGER=cat man -l tool.1 | col -b | grep -A1 '^SYNOPSIS'", example_output: 'SYNOPSIS\n       tool [OPTIONS]',
      task: 'Render gymtool.1 and print the SYNOPSIS heading plus its following line.',
      solution: "MANPAGER=cat man -l gymtool.1 | col -b | grep -A1 '^SYNOPSIS'", files: { 'gymtool.1': '.TH GYMTOOL 1\n.SH NAME\ngymtool \\- practice helper\n.SH SYNOPSIS\ngymtool [OPTIONS]\n.SH DESCRIPTION\nA local practice command.\n' },
      checks: [{ type: 'stdout-contains', description: 'The synopsis invocation was extracted.', expected: 'gymtool [OPTIONS]' }],
    },
    {
      title: 'Answer a question from local documentation', focus: 'Manual pages become operational references when a pipeline extracts the exact option a workflow needs.',
      example: "MANPAGER=cat man -l tool.1 | col -b | grep -- '--dry-run'", example_output: '       --dry-run  preview changes',
      task: 'Use man to render deploy.1, then print the line documenting --check.',
      solution: "MANPAGER=cat man -l deploy.1 | col -b | grep -- '--check'", files: { 'deploy.1': '.TH DEPLOY 1\n.SH NAME\ndeploy \\- publish an artifact\n.SH OPTIONS\n.TP\n.B --check\nvalidate without publishing\n.TP\n.B --force\npublish without prompting\n' },
      checks: [{ type: 'stdout-contains', description: 'The --check option was found in the manual.', expected: '--check' }],
    },
  ],
};
