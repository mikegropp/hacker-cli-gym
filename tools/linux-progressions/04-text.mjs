const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];

export default {
  cut: [
    {
      title: 'Select character positions', focus: 'cut -c selects fixed character positions when records have a dependable layout.',
      example: 'cut -c1-4 codes.txt', example_output: 'ABCD\nEFGH',
      task: 'Print the first three characters from every line in codes.txt.',
      solution: 'cut -c1-3 codes.txt', files: { 'codes.txt': 'API-ready\nWEB-ready\nDBA-ready\n' }, checks: out('API\nWEB\nDBA'),
    },
    {
      title: 'Select several delimited fields', focus: 'A comma-separated field list selects multiple columns while preserving their input order.',
      example: "cut -d, -f1,3 inventory.csv", example_output: 'router,up\nswitch,down',
      task: 'Print the name and role fields, columns 1 and 3, from people.csv.',
      solution: "cut -d, -f1,3 people.csv", files: { 'people.csv': 'alice,42,admin\nbob,35,analyst\ncarol,29,developer\n' }, checks: out('alice,admin\nbob,analyst\ncarol,developer'),
    },
    {
      title: 'Complement selected fields', focus: 'The --complement option prints every field except those named by -f.',
      example: "cut -d: -f2 --complement records.txt", example_output: 'id:status',
      task: 'Remove the secret second field from accounts.txt and print the remaining fields.',
      solution: "cut -d: -f2 --complement accounts.txt", files: { 'accounts.txt': 'alice:token-a:active\nbob:token-b:locked\n' }, checks: out('alice:active\nbob:locked'),
    },
    {
      title: 'Extract fields from filtered records', focus: 'grep can select relevant records before cut projects only the columns needed downstream.',
      example: "grep ',failed,' jobs.csv | cut -d, -f1,4", example_output: 'backup,nightly',
      task: 'From services.csv, select enabled rows and print service=port pairs using fields 1 and 3.',
      solution: "grep ',enabled,' services.csv | cut -d, -f1,3 | sed 's/,/=/'", files: { 'services.csv': 'api,enabled,8080\ndb,disabled,5432\nweb,enabled,443\n' }, checks: out('api=8080\nweb=443'),
    },
  ],
  paste: [
    {
      title: 'Join columns with a delimiter', focus: 'paste -d chooses the delimiter inserted between corresponding input lines.',
      example: "paste -d, names.txt scores.txt", example_output: 'alice,90\nbob,85',
      task: 'Join hosts.txt and ports.txt with a colon.',
      solution: "paste -d: hosts.txt ports.txt", files: { 'hosts.txt': 'api\ndb\nweb\n', 'ports.txt': '8080\n5432\n443\n' }, checks: out('api:8080\ndb:5432\nweb:443'),
    },
    {
      title: 'Combine three aligned files', focus: 'paste aligns corresponding lines from any number of files into wider records.',
      example: 'paste names.txt roles.txt teams.txt', example_output: 'alice\tadmin\tblue',
      task: 'Create tab-separated name, status, and owner rows from three files.',
      solution: 'paste names.txt status.txt owners.txt', files: { 'names.txt': 'api\ndb\n', 'status.txt': 'up\ndown\n', 'owners.txt': 'platform\ndata\n' }, checks: out('api\tup\tplatform\ndb\tdown\tdata'),
    },
    {
      title: 'Serialize lines from one file', focus: 'paste -s combines successive lines from each input file onto one output row.',
      example: "paste -sd, values.txt", example_output: 'one,two,three',
      task: 'Turn tags.txt into one comma-separated line.', solution: "paste -sd, tags.txt", files: { 'tags.txt': 'linux\ncli\npractice\n' }, checks: out('linux,cli,practice'),
    },
    {
      title: 'Build records from generated columns', focus: 'Process substitution lets paste align columns produced by separate transformations.',
      example: "paste -d= <(cut -d, -f1 data.csv) <(cut -d, -f2 data.csv)", example_output: 'api=up\ndb=down',
      task: 'Use paste and process substitution to print service=port from services.csv.',
      solution: "paste -d= <(cut -d, -f1 services.csv) <(cut -d, -f3 services.csv)", files: { 'services.csv': 'api,tcp,8080\ndb,tcp,5432\nweb,tcp,443\n' }, checks: out('api=8080\ndb=5432\nweb=443'),
    },
  ],
  grep: [
    {
      title: 'Match case-insensitively', focus: 'grep -i matches text without treating letter case as significant.',
      example: "grep -i 'error' app.log", example_output: 'ERROR timeout\nError retry',
      task: 'Print every warning line from app.log regardless of case.',
      solution: "grep -i 'warning' app.log", files: { 'app.log': 'INFO start\nWARNING disk\nWarning memory\nwarning network\nINFO end\n' }, checks: out('WARNING disk\nWarning memory\nwarning network'),
    },
    {
      title: 'Show matching line numbers', focus: 'grep -n prefixes each match with its source line number.',
      example: "grep -n '^ERROR' app.log", example_output: '3:ERROR timeout',
      task: 'Print TODO lines from plan.txt with their line numbers.',
      solution: "grep -n 'TODO' plan.txt", files: { 'plan.txt': 'done setup\nTODO test\nnotes\nTODO deploy\n' }, checks: out('2:TODO test\n4:TODO deploy'),
    },
    {
      title: 'Search selected files recursively', focus: 'grep -R descends a tree while --include restricts the filename pattern being searched.',
      example: "grep -R --include='*.conf' 'debug=true' config", example_output: 'config/app.conf:debug=true',
      task: 'Recursively find timeout=30 only in .ini files below services.',
      solution: "grep -R --include='*.ini' 'timeout=30' services", files: { 'services/api/app.ini': 'timeout=30\n', 'services/web/app.ini': 'timeout=10\n', 'services/db/notes.txt': 'timeout=30\n' },
      checks: [{ type: 'stdout-contains', description: 'The matching INI file was reported.', expected: 'services/api/app.ini:timeout=30' }],
    },
    {
      title: 'Summarize matches by file', focus: 'grep -c reports a per-file match count, which can feed a compact operational summary.',
      example: "grep -c '^ERROR' *.log", example_output: 'api.log:2\nweb.log:1',
      task: 'Count ERROR lines in api.log, db.log, and web.log.',
      solution: "grep -c '^ERROR' api.log db.log web.log", files: { 'api.log': 'ERROR one\nINFO ok\nERROR two\n', 'db.log': 'INFO ok\n', 'web.log': 'ERROR three\n' }, checks: out('api.log:2\ndb.log:0\nweb.log:1'),
    },
  ],
  sed: [
    {
      title: 'Replace every occurrence', focus: 'The g flag applies a substitution to every match on each line instead of only the first.',
      example: "sed 's/dev/prod/g' config.txt", example_output: 'prod prod',
      task: 'Replace every occurrence of localhost with api.internal in endpoints.txt.',
      solution: "sed 's/localhost/api.internal/g' endpoints.txt", files: { 'endpoints.txt': 'http://localhost:8080 localhost\nbackup=localhost\n' }, checks: out('http://api.internal:8080 api.internal\nbackup=api.internal'),
    },
    {
      title: 'Print a selected line range', focus: 'sed -n suppresses normal output while an address range plus p prints only chosen lines.',
      example: "sed -n '3,5p' notes.txt", example_output: 'three\nfour\nfive',
      task: 'Print lines 2 through 4 of runbook.txt.',
      solution: "sed -n '2,4p' runbook.txt", files: { 'runbook.txt': 'prepare\nbuild\ntest\ndeploy\nverify\n' }, checks: out('build\ntest\ndeploy'),
    },
    {
      title: 'Delete comments and blank lines', focus: 'Multiple sed expressions can remove noise and leave only active configuration records.',
      example: "sed -e '/^#/d' -e '/^$/d' app.conf", example_output: 'mode=prod\nport=8080',
      task: 'Print services.conf without comments or blank lines.',
      solution: "sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' services.conf", files: { 'services.conf': '# services\n\napi=enabled\n  # old db\nweb=enabled\n\n' }, checks: out('api=enabled\nweb=enabled'),
    },
    {
      title: 'Edit a configuration file in place', focus: 'sed -i writes the transformation back to the file; a suffix can retain a reviewable backup.',
      example: "sed -i.bak 's/^mode=.*/mode=prod/' app.conf", example_output: '',
      task: 'Change mode=dev to mode=production in app.conf and retain app.conf.bak.',
      solution: "sed -i.bak 's/^mode=.*/mode=production/' app.conf", files: { 'app.conf': 'mode=dev\nport=8080\n' }, checks: [
        { type: 'file-content', description: 'The active configuration was updated.', path: 'app.conf', expected: 'mode=production\nport=8080\n' },
        { type: 'file-content', description: 'The original configuration was backed up.', path: 'app.conf.bak', expected: 'mode=dev\nport=8080\n' },
      ],
    },
  ],
  awk: [
    {
      title: 'Filter records by a field', focus: 'An awk pattern can compare a named field and run an action only for matching records.',
      example: "awk -F, '$3 == \"down\" {print $1}' inventory.csv", example_output: 'db',
      task: 'Print the names in field 1 where field 3 is failed.',
      solution: "awk -F, '$3 == \"failed\" {print $1}' jobs.csv", files: { 'jobs.csv': 'api,12,ok\ndb,7,failed\nweb,19,ok\nbackup,4,failed\n' }, checks: out('db\nbackup'),
    },
    {
      title: 'Calculate a derived field', focus: 'awk performs arithmetic directly on numeric fields while formatting the output record.',
      example: "awk -F, '{print $1, $2 * 2}' values.csv", example_output: 'alpha 20',
      task: 'Print item=total where total is quantity field 2 times price field 3.',
      solution: "awk -F, '{printf \"%s=%.2f\\n\", $1, $2 * $3}' orders.csv", files: { 'orders.csv': 'cable,3,4.50\nadapter,2,8.25\n' }, checks: out('cable=13.50\nadapter=16.50'),
    },
    {
      title: 'Aggregate across all records', focus: 'Variables accumulate values per record and an END block prints the final summary once.',
      example: "awk -F, '{sum += $2} END {print sum}' values.csv", example_output: '42',
      task: 'Print total_requests=<sum of field 2> from traffic.csv.',
      solution: "awk -F, '{sum += $2} END {print \"total_requests=\" sum}' traffic.csv", files: { 'traffic.csv': 'api,120\nweb,80\ndb,35\n' }, checks: out('total_requests=235'),
    },
    {
      title: 'Summarize records by category', focus: 'Associative arrays let awk accumulate one value per category before an END block emits a grouped report.',
      example: "awk -F, '{sum[$1]+=$2} END {for (k in sum) print k,sum[k]}' data.csv", example_output: 'blue 12\ngreen 8',
      task: 'Sum field 3 by team field 2 and print sorted team=total rows.',
      solution: "awk -F, '{sum[$2]+=$3} END {for (team in sum) print team \"=\" sum[team]}' usage.csv | sort", files: { 'usage.csv': 'api,blue,10\nweb,green,7\ndb,blue,4\ncache,green,3\n' }, checks: out('blue=14\ngreen=10'),
    },
  ],
  tr: [
    {
      title: 'Normalize letter case', focus: 'Character classes let tr convert all lowercase letters to uppercase without listing an alphabet.',
      example: "tr '[:lower:]' '[:upper:]' < names.txt", example_output: 'ALICE\nBOB',
      task: 'Print tags.txt with every letter converted to lowercase.',
      solution: "tr '[:upper:]' '[:lower:]' < tags.txt", files: { 'tags.txt': 'LINUX\nCli\nPRACTICE\n' }, checks: out('linux\ncli\npractice'),
    },
    {
      title: 'Delete unwanted characters', focus: 'tr -d removes every character belonging to the specified set.',
      example: "tr -d ' -' < phone.txt", example_output: '5551234567',
      task: 'Remove parentheses, spaces, and hyphens from phone.txt.',
      solution: "tr -d '() -' < phone.txt", files: { 'phone.txt': '(555) 123-4567\n' }, checks: out('5551234567'),
    },
    {
      title: 'Squeeze repeated whitespace', focus: 'tr -s collapses each run of characters in a set to one occurrence.',
      example: "tr -s ' ' < rough.txt", example_output: 'one two three',
      task: 'Collapse every run of spaces in rough.txt to one space.',
      solution: "tr -s ' ' < rough.txt", files: { 'rough.txt': 'alpha     beta  gamma\ndelta   epsilon\n' }, checks: out('alpha beta gamma\ndelta epsilon'),
    },
    {
      title: 'Create safe identifier slugs', focus: 'Case conversion, character translation, and squeezing combine into a small text-normalization workflow.',
      example: "printf 'API Service' | tr '[:upper:] ' '[:lower:]-'", example_output: 'api-service',
      task: 'Convert each title in titles.txt to a lowercase hyphenated slug with repeated hyphens squeezed.',
      solution: "tr '[:upper:] ' '[:lower:]-' < titles.txt | tr -s '-'", files: { 'titles.txt': 'API  Gateway\nDatabase Backup\nCLI   Practice\n' }, checks: out('api-gateway\ndatabase-backup\ncli-practice'),
    },
  ],
  sort: [
    {
      title: 'Sort numbers numerically', focus: 'sort -n compares numeric value rather than lexicographic character order.',
      example: 'sort -n values.txt', example_output: '2\n10\n100',
      task: 'Print scores.txt in ascending numeric order.', solution: 'sort -n scores.txt', files: { 'scores.txt': '42\n7\n100\n15\n3\n' }, checks: out('3\n7\n15\n42\n100'),
    },
    {
      title: 'Sort by a delimited field', focus: 'The -t and -k options select a field to use as the sort key.',
      example: "sort -t, -k2,2 inventory.csv", example_output: 'db,down\napi,up',
      task: 'Sort people.csv alphabetically by role in field 3.',
      solution: "sort -t, -k3,3 people.csv", files: { 'people.csv': 'alice,42,developer\nbob,35,admin\ncarol,29,analyst\n' }, checks: out('bob,35,admin\ncarol,29,analyst\nalice,42,developer'),
    },
    {
      title: 'Sort a numeric field descending', focus: 'A key can carry numeric and reverse modifiers so only that field controls descending order.',
      example: "sort -t, -k2,2nr scores.csv", example_output: 'alice,98\nbob,85',
      task: 'Sort usage.csv from highest to lowest value in field 2.',
      solution: "sort -s -t, -k2,2nr usage.csv", files: { 'usage.csv': 'api,120\ndb,35\nweb,80\ncache,80\n' }, checks: out('api,120\nweb,80\ncache,80\ndb,35'),
    },
    {
      title: 'Apply primary and secondary keys', focus: 'Multiple -k keys provide deterministic ordering when primary values tie.',
      example: "sort -t, -k2,2 -k3,3nr data.csv", example_output: 'a,blue,9\nb,blue,4\nc,green,7',
      task: 'Sort jobs.csv by status field 2 alphabetically, then duration field 3 numerically descending.',
      solution: "sort -t, -k2,2 -k3,3nr jobs.csv", files: { 'jobs.csv': 'api,ok,12\nbackup,failed,4\ndb,failed,9\nweb,ok,20\n' }, checks: out('db,failed,9\nbackup,failed,4\nweb,ok,20\napi,ok,12'),
    },
  ],
  uniq: [
    {
      title: 'Count adjacent duplicates', focus: 'uniq -c prefixes each run with its occurrence count; sorted input groups matching values first.',
      example: 'sort names.txt | uniq -c', example_output: '      2 alice\n      1 bob',
      task: 'Sort status.txt and print counts for each status.',
      solution: 'sort status.txt | uniq -c', files: { 'status.txt': 'up\ndown\nup\nunknown\ndown\nup\n' },
      checks: [{ type: 'stdout-contains', description: 'The down count is two.', expected: '2 down' }, { type: 'stdout-contains', description: 'The up count is three.', expected: '3 up' }],
    },
    {
      title: 'Print only duplicated values', focus: 'uniq -d emits one representative only for values that occur more than once in adjacent input.',
      example: 'sort names.txt | uniq -d', example_output: 'alice',
      task: 'Print only IDs that appear more than once in ids.txt.',
      solution: 'sort ids.txt | uniq -d', files: { 'ids.txt': 'A12\nB07\nA12\nC33\nB07\nD99\n' }, checks: out('A12\nB07'),
    },
    {
      title: 'Print values that occur once', focus: 'uniq -u emits only runs with a single record, useful for finding unmatched values.',
      example: 'sort names.txt | uniq -u', example_output: 'bob',
      task: 'Print only tags that occur exactly once.',
      solution: 'sort tags.txt | uniq -u', files: { 'tags.txt': 'linux\ncli\nlinux\nshell\ndocker\ncli\n' }, checks: out('docker\nshell'),
    },
    {
      title: 'Deduplicate by a later field', focus: 'uniq -f skips leading fields during comparison while preserving the first full record in each run.',
      example: "sort -k2 records.txt | uniq -f1", example_output: '1 blue\n3 green',
      task: 'Sort sessions.txt by username field 2 and retain the first session ID for each username.',
      solution: 'sort -k2,2 sessions.txt | uniq -f1', files: { 'sessions.txt': '101 alice\n102 bob\n103 alice\n104 carol\n105 bob\n' }, checks: out('101 alice\n102 bob\n104 carol'),
    },
  ],
  column: [
    {
      title: 'Align a delimited table', focus: 'column -t with -s parses a delimiter and aligns values into readable columns.',
      example: 'column -t -s, data.csv', example_output: 'api  up\ndb   down',
      task: 'Format inventory.csv as aligned columns using comma as the separator.',
      solution: 'column -t -s, inventory.csv', files: { 'inventory.csv': 'service,status,port\napi,up,8080\ndatabase,down,5432\nweb,up,443\n' },
      checks: [{ type: 'stdout-contains', description: 'The long database name was preserved.', expected: 'database' }, { type: 'stdout-contains', description: 'The header was preserved.', expected: 'service' }],
    },
    {
      title: 'Choose an output separator', focus: 'The -o option controls the text inserted between aligned output columns.',
      example: "column -t -s, -o ' | ' data.csv", example_output: 'api | up',
      task: 'Format services.csv with " | " between aligned columns.',
      solution: "column -t -s, -o ' | ' services.csv", files: { 'services.csv': 'api,enabled,8080\ndatabase,disabled,5432\n' },
      checks: [{ type: 'stdout-contains', description: 'Pipe separators were added.', expected: ' | ' }, { type: 'stdout-contains', description: 'The database row was included.', expected: 'database' }],
    },
    {
      title: 'Format whitespace records', focus: 'Without -s, column -t treats whitespace as field separation and aligns a simple report.',
      example: "printf 'NAME STATUS\\napi up\\ndatabase down\\n' | column -t", example_output: 'NAME      STATUS\napi       up\ndatabase  down',
      task: 'Align the whitespace-separated rows in processes.txt.',
      solution: 'column -t processes.txt', files: { 'processes.txt': 'PID NAME STATE\n7 api running\n42 database stopped\n105 worker running\n' },
      checks: [{ type: 'stdout-contains', description: 'The process header was shown.', expected: 'PID' }, { type: 'stdout-contains', description: 'The database row was shown.', expected: 'database' }],
    },
    {
      title: 'Create a readable filtered report', focus: 'A selection pipeline can produce delimited rows that column turns into a human-readable operational report.',
      example: "awk -F, '$2==\"down\" {print $1,$2,$3}' data.csv | column -t", example_output: 'db  down  5432',
      task: 'Select enabled services, format service, port, and owner as tab-separated fields, and align them with column -t.',
      solution: "awk -F, '$2==\"enabled\" {print $1 \"\\t\" $3 \"\\t\" $4}' services.csv | column -t", files: { 'services.csv': 'api,enabled,8080,platform\ndb,disabled,5432,data\nweb,enabled,443,frontend\n' },
      checks: [{ type: 'stdout-contains', description: 'The API service was included.', expected: 'api' }, { type: 'stdout-contains', description: 'The web owner was included.', expected: 'frontend' }],
    },
  ],
  fmt: [
    {
      title: 'Wrap text to a chosen width', focus: 'fmt -w sets a target output width for reflowing prose.',
      example: 'fmt -w 30 paragraph.txt', example_output: 'A paragraph wrapped near thirty\ncolumns.',
      task: 'Reflow paragraph.txt to a width of 32 columns.',
      solution: 'fmt -w 32 paragraph.txt', files: { 'paragraph.txt': 'Command line practice becomes easier when each exercise has a clear goal and immediate feedback.\n' },
      checks: [{ type: 'stdout-contains', description: 'The paragraph text remained intact.', expected: 'Command line practice' }],
    },
    {
      title: 'Preserve a uniform prefix', focus: 'fmt -p reflows only lines carrying a chosen prefix and preserves that prefix on output lines.',
      example: "fmt -w 30 -p '# ' comments.txt", example_output: '# A wrapped comment that\n# keeps its prefix.',
      task: 'Wrap the # comment in comments.txt to width 36 while preserving the prefix.',
      solution: "fmt -w 36 -p '# ' comments.txt", files: { 'comments.txt': '# This operational note should wrap cleanly while every output line remains a shell comment.\nmode=practice\n' },
      checks: [{ type: 'stdout-contains', description: 'The comment prefix was preserved.', expected: '# This operational' }],
    },
    {
      title: 'Format tagged paragraphs', focus: 'fmt -t treats the first line indentation as a tag and aligns later lines as paragraph text.',
      example: 'fmt -w 40 -t options.txt', example_output: '--check  Validate the deployment before\n         publishing anything.',
      task: 'Format options.txt as tagged paragraphs at width 42.',
      solution: 'fmt -w 42 -t options.txt', files: { 'options.txt': '--check  Validate all configuration and dependencies without publishing any files.\n--force  Publish without the usual confirmation prompt when automation has already reviewed the plan.\n' },
      checks: [{ type: 'stdout-contains', description: 'The check tag was preserved.', expected: '--check' }, { type: 'stdout-contains', description: 'The force tag was preserved.', expected: '--force' }],
    },
    {
      title: 'Normalize prose from a pipeline', focus: 'tr can first collapse irregular whitespace before fmt reflows clean paragraphs to a standard width.',
      example: "tr -s ' ' < rough.txt | fmt -w 40", example_output: 'Clean consistently wrapped prose...',
      task: 'Collapse repeated spaces in rough.txt and reflow the result to width 38.',
      solution: "tr -s ' ' < rough.txt | fmt -w 38", files: { 'rough.txt': 'A   concise   runbook   is easier to review, update, and use during an incident when every paragraph follows a predictable width.\n' },
      checks: [{ type: 'stdout-contains', description: 'The normalized runbook text was emitted.', expected: 'A concise runbook' }],
    },
  ],
};
