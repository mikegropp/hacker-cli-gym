const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];
const content = (path, expected, description = `${path} has the expected content.`) => ({ type: 'file-content', description, path, expected });
const exists = (path, kind = 'file') => ({ type: 'path-exists', description: `${path} exists.`, path, kind });

export default {
  echo: [
    {
      title: 'Suppress the trailing newline', focus: 'echo -n omits its usual final newline when output must continue on the same line.',
      example: "echo -n 'prefix='", example_output: 'prefix=',
      task: 'Print token=abc123 without a trailing newline.', solution: "echo -n 'token=abc123'", checks: out('token=abc123', 'The text was printed without an added newline.', 'exact'),
    },
    {
      title: 'Interpret escape sequences', focus: 'Bash echo -e interprets escapes such as newline and tab in a controlled string.',
      example: "echo -e 'name\\tstatus'", example_output: 'name\tstatus',
      task: 'Print alpha, beta, and gamma on separate lines from one echo command.', solution: "echo -e 'alpha\\nbeta\\ngamma'", checks: out('alpha\nbeta\ngamma'),
    },
    {
      title: 'Compose output from variables', focus: 'Quoted parameter expansion lets echo combine labels and shell values without accidental word splitting.',
      example: "name=api; echo \"service=$name\"", example_output: 'service=api',
      task: 'Set service to web and port to 443, then print service=web port=443.',
      solution: 'service=web; port=443; echo "service=$service port=$port"', checks: out('service=web port=443'),
    },
    {
      title: 'Generate a simple environment file', focus: 'A grouped set of echo commands can emit a short reviewed configuration atomically through one redirection.',
      example: "{ echo 'MODE=prod'; echo 'PORT=8080'; } > app.env", example_output: '',
      task: 'Create service.env containing NAME=api, PORT=8080, and ENABLED=true on separate lines.',
      solution: "{ echo 'NAME=api'; echo 'PORT=8080'; echo 'ENABLED=true'; } > service.env",
      checks: [content('service.env', 'NAME=api\nPORT=8080\nENABLED=true\n')],
    },
  ],
  printf: [
    {
      title: 'Control field width', focus: 'Width specifiers align values into predictable columns without a separate formatting tool.',
      example: "printf '%-10s %5d\\n' api 42", example_output: 'api           42',
      task: 'Print api left-aligned in width 10 and 8080 right-aligned in width 6.',
      solution: "printf '%-10s %6d\\n' api 8080", checks: out('api          8080', 'The fields were aligned.', 'exact'),
    },
    {
      title: 'Choose numeric precision', focus: 'A precision on %f controls how many digits appear after the decimal point.',
      example: "printf '%.2f\\n' 3.14159", example_output: '3.14',
      task: 'Print 98.7654 rounded to two decimal places followed by a percent sign.',
      solution: "printf '%.2f%%\\n' 98.7654", checks: out('98.77%'),
    },
    {
      title: 'Reuse a format for many values', focus: 'printf reuses its format string until all remaining arguments have been consumed.',
      example: "printf '%s\\n' alpha beta gamma", example_output: 'alpha\nbeta\ngamma',
      task: 'Print api=8080, db=5432, and web=443 using one reusable format string.',
      solution: "printf '%s=%s\\n' api 8080 db 5432 web 443", checks: out('api=8080\ndb=5432\nweb=443'),
    },
    {
      title: 'Format a report from parsed records', focus: 'read and printf combine parsing with consistent types, widths, and alignment in a shell workflow.',
      example: "while IFS=, read -r name value; do printf '%-8s %4d\\n' \"$name\" \"$value\"; done < data.csv", example_output: 'api        42',
      task: 'Read usage.csv and print each name left-aligned width 8, a space, and its value right-aligned width 4.',
      solution: "while IFS=, read -r name value; do printf '%-8s %4d\\n' \"$name\" \"$value\"; done < usage.csv", files: { 'usage.csv': 'api,12\ndatabase,7\nweb,105\n' },
      checks: out('api        12\ndatabase    7\nweb       105', 'The usage report was formatted.', 'exact'),
    },
  ],
  tee: [
    {
      title: 'Append while displaying output', focus: 'tee -a appends to a file instead of replacing it while still forwarding the new input.',
      example: "echo beta | tee -a log.txt", example_output: 'beta',
      task: 'Append deployed to events.log and also print deployed.',
      solution: "echo deployed | tee -a events.log", files: { 'events.log': 'started\n' },
      checks: [...out('deployed'), content('events.log', 'started\ndeployed\n')],
    },
    {
      title: 'Write the same stream to several files', focus: 'tee accepts multiple file operands and writes an identical copy to each.',
      example: "printf 'ready\\n' | tee one.txt two.txt", example_output: 'ready',
      task: 'Write release-2026 to primary.txt, backup.txt, and standard output.',
      solution: "echo release-2026 | tee primary.txt backup.txt", checks: [...out('release-2026'), content('primary.txt', 'release-2026\n'), content('backup.txt', 'release-2026\n')],
    },
    {
      title: 'Capture an intermediate pipeline stage', focus: 'tee can preserve intermediate data for debugging while allowing the pipeline to continue transforming it.',
      example: 'sort values.txt | tee sorted.txt | uniq', example_output: 'a\nb',
      task: 'Sort names.txt, save the full sorted stream to sorted.txt, then print unique names.',
      solution: 'sort names.txt | tee sorted.txt | uniq', files: { 'names.txt': 'bob\nalice\nbob\ncarol\nalice\n' },
      checks: [...out('alice\nbob\ncarol'), content('sorted.txt', 'alice\nalice\nbob\nbob\ncarol\n')],
    },
    {
      title: 'Publish a report and retain its source', focus: 'A pipeline ending in tee can make a generated report visible and persist the exact reviewed output.',
      example: "awk -F, '{print $1 \"=\" $2}' data.csv | tee report.txt", example_output: 'api=up',
      task: 'Select failed jobs as name=owner rows, print them, and save the same rows to failed.txt.',
      solution: "awk -F, '$2==\"failed\" {print $1 \"=\" $3}' jobs.csv | tee failed.txt", files: { 'jobs.csv': 'api,ok,platform\ndb,failed,data\nweb,ok,frontend\nbackup,failed,ops\n' },
      checks: [...out('db=data\nbackup=ops'), content('failed.txt', 'db=data\nbackup=ops\n')],
    },
  ],
  xargs: [
    {
      title: 'Group a fixed number of arguments', focus: 'xargs -n limits how many input items are supplied to each command invocation.',
      example: "printf '%s\\n' a b c d | xargs -n2 echo", example_output: 'a b\nc d',
      task: 'Read words.txt and print them in groups of three per line.',
      solution: 'xargs -n3 echo < words.txt', files: { 'words.txt': 'one\ntwo\nthree\nfour\nfive\nsix\n' }, checks: out('one two three\nfour five six'),
    },
    {
      title: 'Insert each item into a template', focus: 'xargs -I replaces a placeholder anywhere in a command template for each input record.',
      example: "printf '%s\\n' api web | xargs -I{} echo service={}", example_output: 'service=api\nservice=web',
      task: 'Read names.txt and print user=<name> for each line.',
      solution: "xargs -I{} echo 'user={}' < names.txt", files: { 'names.txt': 'alice\nbob\ncarol\n' }, checks: out('user=alice\nuser=bob\nuser=carol'),
    },
    {
      title: 'Handle filenames containing spaces', focus: 'Null-delimited input with xargs -0 preserves filenames exactly, including embedded spaces.',
      example: "find docs -type f -print0 | xargs -0 wc -l", example_output: '2 docs/one file.txt',
      task: 'Find .txt files under docs with -print0 and pass them safely to wc -l.',
      solution: "find docs -type f -name '*.txt' -print0 | sort -z | xargs -0 wc -l", files: { 'docs/one file.txt': 'a\nb\n', 'docs/two file.txt': 'c\nd\ne\n' },
      checks: [{ type: 'stdout-contains', description: 'The spaced first filename was processed.', expected: 'docs/one file.txt' }, { type: 'stdout-contains', description: 'The spaced second filename was processed.', expected: 'docs/two file.txt' }],
    },
    {
      title: 'Build artifacts from a manifest', focus: 'A reviewed manifest plus xargs can apply the same creation command consistently to many items.',
      example: "xargs -I{} sh -c 'mkdir -p output/{}' < names.txt", example_output: '',
      task: 'Read directories.txt and use xargs with mkdir -p to create each path.',
      solution: 'xargs mkdir -p < directories.txt', files: { 'directories.txt': 'build/api\nbuild/web\nbuild/database\n' },
      checks: ['build/api', 'build/web', 'build/database'].map(path => exists(path, 'directory')),
    },
  ],
  diff: [
    {
      title: 'Produce a unified diff', focus: 'diff -u adds file headers and contextual hunks in the format commonly reviewed as a patch.',
      example: 'diff -u old.conf new.conf', example_output: '--- old.conf\n+++ new.conf\n@@ ...',
      task: 'Print a unified diff between old.conf and new.conf.',
      solution: 'diff -u old.conf new.conf || true', files: { 'old.conf': 'mode=dev\nport=8080\n', 'new.conf': 'mode=prod\nport=8080\n' },
      checks: [{ type: 'stdout-contains', description: 'The removed setting was shown.', expected: '-mode=dev' }, { type: 'stdout-contains', description: 'The added setting was shown.', expected: '+mode=prod' }],
    },
    {
      title: 'Compare files side by side', focus: 'diff -y presents old and new lines in adjacent columns for a visual review.',
      example: 'diff -y old.txt new.txt', example_output: 'same  same\nold | new',
      task: 'Compare before.txt and after.txt side by side.',
      solution: 'diff -y before.txt after.txt || true', files: { 'before.txt': 'alpha\nbeta\ngamma\n', 'after.txt': 'alpha\nBETA\ngamma\n' },
      checks: [{ type: 'stdout-contains', description: 'The changed uppercase line was shown.', expected: 'BETA' }],
    },
    {
      title: 'Report only whether files differ', focus: 'diff -q suppresses line details and reports only whether two files differ.',
      example: 'diff -q a.txt b.txt', example_output: 'Files a.txt and b.txt differ',
      task: 'Use diff -q to report whether expected.txt and actual.txt differ.',
      solution: 'diff -q expected.txt actual.txt || true', files: { 'expected.txt': 'ready\n', 'actual.txt': 'pending\n' }, checks: out('Files expected.txt and actual.txt differ'),
    },
    {
      title: 'Compare directory trees recursively', focus: 'diff -r descends corresponding directory trees and reports changed or missing files.',
      example: 'diff -r baseline candidate', example_output: 'diff -r baseline/app.conf candidate/app.conf ...',
      task: 'Recursively compare baseline and candidate and show every difference.',
      solution: 'diff -r baseline candidate || true', files: { 'baseline/app.conf': 'mode=prod\n', 'baseline/keep.txt': 'same\n', 'candidate/app.conf': 'mode=stage\n', 'candidate/keep.txt': 'same\n', 'candidate/new.txt': 'new\n' },
      checks: [{ type: 'stdout-contains', description: 'The changed configuration was reported.', expected: 'app.conf' }, { type: 'stdout-contains', description: 'The candidate-only file was reported.', expected: 'new.txt' }],
    },
  ],
  cmp: [
    {
      title: 'Silently test equality', focus: 'cmp -s emits nothing and communicates equality through its exit status.',
      example: 'cmp -s expected.bin actual.bin && echo match', example_output: 'match',
      task: 'Use cmp -s and print identical when copy.bin matches original.bin.',
      solution: 'cmp -s original.bin copy.bin && echo identical', files: { 'original.bin': 'same bytes\n', 'copy.bin': 'same bytes\n' }, checks: out('identical'),
    },
    {
      title: 'Report the first differing byte', focus: 'Default cmp output identifies the first byte and line where two files differ.',
      example: 'cmp old.bin new.bin', example_output: 'old.bin new.bin differ: byte 5, line 1',
      task: 'Compare expected.bin and actual.bin and print the first-difference report.',
      solution: 'cmp expected.bin actual.bin || true', files: { 'expected.bin': 'HEAD-ONE\n', 'actual.bin': 'HEAD-TWO\n' }, checks: [{ type: 'stdout-contains', description: 'The first differing byte was reported.', expected: 'differ: byte' }],
    },
    {
      title: 'List every differing byte', focus: 'cmp -l prints the position and byte values for every difference.',
      example: 'cmp -l a.bin b.bin', example_output: '2 102 130',
      task: 'Use cmp -l to list all byte differences between a.bin and b.bin.',
      solution: 'cmp -l a.bin b.bin || true', files: { 'a.bin': 'ABCDEF', 'b.bin': 'AXCYEZ' }, checks: out('2 102 130\n4 104 131\n6 106 132'),
    },
    {
      title: 'Validate only a fixed header', focus: 'The -n limit compares only an initial byte range, useful when validating a header independently of payload data.',
      example: 'cmp -s -n 4 one.bin two.bin && echo header-ok', example_output: 'header-ok',
      task: 'Compare only the first six bytes of expected.bin and actual.bin and print header-ok when they match.',
      solution: 'cmp -s -n 6 expected.bin actual.bin && echo header-ok', files: { 'expected.bin': 'HEADERpayload-one', 'actual.bin': 'HEADERdifferent-payload' }, checks: out('header-ok'),
    },
  ],
  comm: [
    {
      title: 'Print values common to both files', focus: 'comm -12 suppresses the two unique columns and leaves only shared sorted lines.',
      example: 'comm -12 old.txt new.txt', example_output: 'shared',
      task: 'Print package names present in both required.txt and installed.txt.',
      solution: 'comm -12 required.txt installed.txt', files: { 'required.txt': 'bash\ncurl\njq\ntar\n', 'installed.txt': 'bash\ngrep\njq\nsed\ntar\n' }, checks: out('bash\njq\ntar'),
    },
    {
      title: 'Print values only in the first file', focus: 'comm -23 suppresses the second-file-only and common columns.',
      example: 'comm -23 desired.txt actual.txt', example_output: 'missing',
      task: 'Print users listed in desired.txt but absent from actual.txt.',
      solution: 'comm -23 desired.txt actual.txt', files: { 'desired.txt': 'alice\nbob\ncarol\ndave\n', 'actual.txt': 'alice\ncarol\n' }, checks: out('bob\ndave'),
    },
    {
      title: 'Compare unsorted inputs safely', focus: 'Process substitution can sort each source before comm performs its required ordered comparison.',
      example: 'comm -3 <(sort one.txt) <(sort two.txt)', example_output: 'only-one\n\tonly-two',
      task: 'Print the differences between unsorted blue.txt and green.txt.',
      solution: 'comm -3 <(sort blue.txt) <(sort green.txt)', files: { 'blue.txt': 'api\ndb\ncache\n', 'green.txt': 'web\napi\ncache\n' },
      checks: [{ type: 'stdout-contains', description: 'The blue-only value was shown.', expected: 'db' }, { type: 'stdout-contains', description: 'The green-only value was shown.', expected: 'web' }],
    },
    {
      title: 'Create a missing-and-extra audit', focus: 'Two comm projections can label missing desired values and extra actual values in one reconciliation report.',
      example: "comm -23 desired actual | sed 's/^/missing: /'; comm -13 desired actual | sed 's/^/extra: /'", example_output: 'missing: db\nextra: cache',
      task: 'Compare sorted desired.txt and actual.txt, printing missing: and extra: labels.',
      solution: "comm -23 desired.txt actual.txt | sed 's/^/missing: /'; comm -13 desired.txt actual.txt | sed 's/^/extra: /'", files: { 'desired.txt': 'api\ndb\nweb\n', 'actual.txt': 'api\ncache\nweb\n' }, checks: out('missing: db\nextra: cache'),
    },
  ],
  join: [
    {
      title: 'Join on a shared key', focus: 'join combines sorted records whose first fields match.',
      example: 'join users.txt roles.txt', example_output: '1 alice admin',
      task: 'Join services.txt and ports.txt on their first field.',
      solution: 'join services.txt ports.txt', files: { 'services.txt': 'api enabled\ndb disabled\nweb enabled\n', 'ports.txt': 'api 8080\ndb 5432\nweb 443\n' }, checks: out('api enabled 8080\ndb disabled 5432\nweb enabled 443'),
    },
    {
      title: 'Join comma-delimited records', focus: 'join -t sets both the input and output field delimiter.',
      example: 'join -t, users.csv roles.csv', example_output: '1,alice,admin',
      task: 'Join inventory.csv and owners.csv using comma as the delimiter.',
      solution: 'join -t, inventory.csv owners.csv', files: { 'inventory.csv': 'api,up\ndb,down\nweb,up\n', 'owners.csv': 'api,platform\ndb,data\nweb,frontend\n' }, checks: out('api,up,platform\ndb,down,data\nweb,up,frontend'),
    },
    {
      title: 'Include unmatched records', focus: 'The -a option includes unpairable lines from one or both inputs instead of dropping them.',
      example: 'join -a1 -a2 one.txt two.txt', example_output: 'shared ...\nonly-one ...\nonly-two ...',
      task: 'Join desired.txt and actual.txt while including unmatched keys from both files.',
      solution: 'join -a1 -a2 desired.txt actual.txt', files: { 'desired.txt': 'api required\ndb required\nweb required\n', 'actual.txt': 'api running\ncache running\nweb stopped\n' },
      checks: [{ type: 'stdout-contains', description: 'The desired-only database row remained.', expected: 'db required' }, { type: 'stdout-contains', description: 'The actual-only cache row remained.', expected: 'cache running' }],
    },
    {
      title: 'Join unsorted data and select output fields', focus: 'Sorted process substitutions satisfy join ordering, while -o chooses and reorders fields in the result.',
      example: "join -t, -o 1.1,1.2,2.2 <(sort data.csv) <(sort owners.csv)", example_output: 'api,up,platform',
      task: 'Sort and join services.csv with owners.csv, printing name, owner, then status.',
      solution: "join -t, -o 1.1,2.2,1.2 <(sort services.csv) <(sort owners.csv)", files: { 'services.csv': 'web,up\napi,up\ndb,down\n', 'owners.csv': 'db,data\nweb,frontend\napi,platform\n' }, checks: out('api,platform,up\ndb,data,down\nweb,frontend,up'),
    },
  ],
  split: [
    {
      title: 'Split by line count', focus: 'split -l creates chunks containing a fixed maximum number of lines.',
      example: 'split -l 2 records.txt chunk-', example_output: '',
      task: 'Split records.txt into two-line files with prefix part-.',
      solution: 'split -l 2 records.txt part-', files: { 'records.txt': 'one\ntwo\nthree\nfour\nfive\n' },
      checks: [content('part-aa', 'one\ntwo\n'), content('part-ab', 'three\nfour\n'), content('part-ac', 'five\n')],
    },
    {
      title: 'Use numeric suffixes', focus: 'The -d option names output chunks with numeric suffixes that sort naturally in many workflows.',
      example: 'split -d -l 2 data.txt chunk-', example_output: '',
      task: 'Split data.txt into three-line chunks named chunk-00, chunk-01, and so on.',
      solution: 'split -d -l 3 data.txt chunk-', files: { 'data.txt': '1\n2\n3\n4\n5\n6\n7\n' }, checks: [content('chunk-00', '1\n2\n3\n'), content('chunk-01', '4\n5\n6\n'), content('chunk-02', '7\n')],
    },
    {
      title: 'Split by byte size', focus: 'split -b caps each output chunk by bytes rather than line boundaries.',
      example: 'split -b 4 payload.bin piece-', example_output: '',
      task: 'Split payload.bin into four-byte chunks with prefix piece-.',
      solution: 'split -b 4 payload.bin piece-', files: { 'payload.bin': 'ABCDEFGHIJ' }, checks: [content('piece-aa', 'ABCD'), content('piece-ab', 'EFGH'), content('piece-ac', 'IJ')],
    },
    {
      title: 'Create named CSV batches', focus: '--additional-suffix gives every chunk a meaningful extension while numeric suffixes preserve batch order.',
      example: 'split -d -l 100 --additional-suffix=.csv export.csv batch-', example_output: '',
      task: 'Split export.csv into two-line batches named batch-00.csv, batch-01.csv, and batch-02.csv.',
      solution: 'split -d -l 2 --additional-suffix=.csv export.csv batch-', files: { 'export.csv': 'a,1\nb,2\nc,3\nd,4\ne,5\n' }, checks: [content('batch-00.csv', 'a,1\nb,2\n'), content('batch-01.csv', 'c,3\nd,4\n'), content('batch-02.csv', 'e,5\n')],
    },
  ],
  csplit: [
    {
      title: 'Split at a matching line', focus: 'A csplit /pattern/ operand starts a new output file immediately before the matching line.',
      example: "csplit document.txt '/^SECTION 2$/'", example_output: '...byte counts...',
      task: 'Split document.txt before the SECTION B line.',
      solution: "csplit -s document.txt '/^SECTION B$/'", files: { 'document.txt': 'SECTION A\none\ntwo\nSECTION B\nthree\nfour\n' }, checks: [content('xx00', 'SECTION A\none\ntwo\n'), content('xx01', 'SECTION B\nthree\nfour\n')],
    },
    {
      title: 'Repeat a split pattern', focus: 'The {*} repeat operand applies the preceding pattern until no further matches remain.',
      example: "csplit log.txt '/^---$/' '{*}'", example_output: '...byte counts...',
      task: 'Split chapters.txt before every CHAPTER heading.',
      solution: "csplit -s chapters.txt '/^CHAPTER/' '{*}'", files: { 'chapters.txt': 'PREFACE\nintro\nCHAPTER ONE\nalpha\nCHAPTER TWO\nbeta\nCHAPTER THREE\ngamma\n' }, checks: [content('xx00', 'PREFACE\nintro\n'), content('xx01', 'CHAPTER ONE\nalpha\n'), content('xx02', 'CHAPTER TWO\nbeta\n'), content('xx03', 'CHAPTER THREE\ngamma\n')],
    },
    {
      title: 'Choose output names and suffix width', focus: 'The -f prefix and -n digit count create predictable chunk names for downstream processing.',
      example: "csplit -s -f part- -n 3 data.txt '/^MARK$/'", example_output: '',
      task: 'Split data.txt at MARK and name outputs segment-000 and segment-001.',
      solution: "csplit -s -f segment- -n 3 data.txt '/^MARK$/'", files: { 'data.txt': 'before\nMARK\nafter\n' }, checks: [content('segment-000', 'before\n'), content('segment-001', 'MARK\nafter\n')],
    },
    {
      title: 'Create one file per timestamped block', focus: 'A repeated regular-expression split can turn a combined stream into independently processable records.',
      example: "csplit -s -f event- log.txt '/^BEGIN /' '{*}'", example_output: '',
      task: 'Split events.log before every BEGIN line, using event- as the output prefix and two-digit suffixes.',
      solution: "csplit -s -f event- events.log '/^BEGIN /' '{*}'", files: { 'events.log': 'metadata\nBEGIN 09:00\napi up\nBEGIN 10:00\ndb down\nBEGIN 11:00\nweb up\n' }, checks: [content('event-00', 'metadata\n'), content('event-01', 'BEGIN 09:00\napi up\n'), content('event-02', 'BEGIN 10:00\ndb down\n'), content('event-03', 'BEGIN 11:00\nweb up\n')],
    },
  ],
};
