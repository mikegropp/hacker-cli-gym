const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];

export default {
  cat: [
    {
      title: 'Combine files in order', focus: 'cat accepts several files and streams their contents in the order given.',
      example: 'cat header.txt body.txt', example_output: 'HEADER\nbody',
      task: 'Print header.txt, body.txt, and footer.txt as one continuous document.',
      solution: 'cat header.txt body.txt footer.txt', files: { 'header.txt': 'TITLE\n', 'body.txt': 'alpha\nbeta\n', 'footer.txt': 'END\n' }, checks: out('TITLE\nalpha\nbeta\nEND'),
    },
    {
      title: 'Number every line', focus: 'cat -n prefixes all output lines, including blank ones, with line numbers.',
      example: 'cat -n notes.txt', example_output: '     1\talpha\n     2\t\n     3\tbeta',
      task: 'Print plan.txt with every line numbered.',
      solution: 'cat -n plan.txt', files: { 'plan.txt': 'prepare\n\ndeploy\n' },
      checks: [{ type: 'stdout-contains', description: 'The first line was numbered.', expected: '1\tprepare' }, { type: 'stdout-contains', description: 'The third line was numbered.', expected: '3\tdeploy' }],
    },
    {
      title: 'Number only nonblank lines', focus: 'cat -b numbers nonblank lines and leaves blank separators unnumbered.',
      example: 'cat -b notes.txt', example_output: '     1\talpha\n\n     2\tbeta',
      task: 'Print checklist.txt with only nonblank lines numbered.',
      solution: 'cat -b checklist.txt', files: { 'checklist.txt': 'build\n\ntest\n\ndeploy\n' },
      checks: [{ type: 'stdout-contains', description: 'The third item received number 3.', expected: '3\tdeploy' }],
    },
    {
      title: 'Collapse repeated blank lines', focus: 'cat -s squeezes each run of blank lines into a single blank separator.',
      example: 'cat -s draft.txt', example_output: 'one\n\ntwo',
      task: 'Print draft.txt with repeated blank lines collapsed.',
      solution: 'cat -s draft.txt', files: { 'draft.txt': 'intro\n\n\nsection\n\n\n\nend\n' }, checks: out('intro\n\nsection\n\nend'),
    },
  ],
  less: [
    {
      title: 'Show line numbers while paging', focus: 'less -N displays line numbers, which makes discussion and troubleshooting easier in long files.',
      example: 'less -N runbook.txt', example_output: '      1 step one\n      2 step two',
      task: 'Use less -N to display runbook.txt with line numbers.',
      solution: 'less -N runbook.txt', files: { 'runbook.txt': 'prepare\nvalidate\ndeploy\n' },
      checks: [{ type: 'stdout-contains', description: 'The runbook content was displayed.', expected: 'validate' }],
    },
    {
      title: 'Open at a search match', focus: 'The +/pattern startup command opens a document at the first matching line in an interactive pager.',
      example: "less +/ERROR app.log", example_output: '... ERROR connection failed ...',
      task: 'Open app.log with less positioned at the first ERROR match.',
      solution: "less +/ERROR app.log", files: { 'app.log': 'INFO start\nDEBUG ready\nERROR connection failed\nINFO retry\n' },
      checks: [{ type: 'stdout-contains', description: 'The target error is present in the pager output.', expected: 'ERROR connection failed' }],
    },
    {
      title: 'Preserve the terminal after exit', focus: 'The -X option prevents less from clearing its displayed content when the pager exits.',
      example: 'less -X report.txt', example_output: 'report contents',
      task: 'Display report.txt with less -X so its contents remain visible after exit.',
      solution: 'less -X report.txt', files: { 'report.txt': 'status: ready\nowner: ops\n' }, checks: [{ type: 'stdout-contains', description: 'The report contents were shown.', expected: 'status: ready' }],
    },
    {
      title: 'Page a pipeline without wrapping', focus: 'less -S keeps long pipeline rows on one visual line so horizontal scrolling remains possible.',
      example: 'grep ERROR app.log | less -S', example_output: 'ERROR a long diagnostic row...',
      task: 'Filter ERROR lines from app.log and send them to less -S.',
      solution: 'grep ERROR app.log | less -S', files: { 'app.log': 'INFO start\nERROR api timeout request=1234567890\nWARN retry\nERROR db unavailable request=9876543210\n' },
      checks: [{ type: 'stdout', description: 'Only error rows reached the pager.', expected: 'ERROR api timeout request=1234567890\nERROR db unavailable request=9876543210', normalize: 'trim' }],
    },
  ],
  head: [
    {
      title: 'Choose a line count', focus: 'head -n sets the exact number of leading lines to print.',
      example: 'head -n 3 events.log', example_output: 'one\ntwo\nthree',
      task: 'Print the first four lines of queue.txt.', solution: 'head -n 4 queue.txt', files: { 'queue.txt': 'alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\n' }, checks: out('alpha\nbeta\ngamma\ndelta'),
    },
    {
      title: 'Read a byte prefix', focus: 'head -c selects an exact byte prefix, useful when inspecting file signatures or fixed headers.',
      example: 'head -c 4 artifact.bin', example_output: 'MAGC',
      task: 'Print the first eight bytes of packet.dat.', solution: 'head -c 8 packet.dat', files: { 'packet.dat': 'HEADER01payload-data' }, checks: out('HEADER01', 'The eight-byte header was printed.', 'exact'),
    },
    {
      title: 'Exclude trailing lines', focus: 'A negative -n count prints everything except the final number of lines.',
      example: 'head -n -2 list.txt', example_output: 'one\ntwo',
      task: 'Print tasks.txt except for its final two archived tasks.',
      solution: 'head -n -2 tasks.txt', files: { 'tasks.txt': 'build\ntest\ndeploy\nold-one\nold-two\n' }, checks: out('build\ntest\ndeploy'),
    },
    {
      title: 'Preview several files with labels', focus: 'head -v prints headers even for a single file and naturally labels previews from several files.',
      example: 'head -n 1 -v api.log web.log', example_output: '==> api.log <==\napi start\n\n==> web.log <==\nweb start',
      task: 'Print the first line of api.log and db.log with filename headers.',
      solution: 'head -n 1 -v api.log db.log', files: { 'api.log': 'api ready\napi next\n', 'db.log': 'db ready\ndb next\n' },
      checks: [{ type: 'stdout-contains', description: 'The api preview was labeled.', expected: '==> api.log <==' }, { type: 'stdout-contains', description: 'The database preview was labeled.', expected: '==> db.log <==' }],
    },
  ],
  tail: [
    {
      title: 'Choose a trailing line count', focus: 'tail -n prints an exact number of lines from the end of a file.',
      example: 'tail -n 3 events.log', example_output: 'eight\nnine\nten',
      task: 'Print the final four entries in history.log.', solution: 'tail -n 4 history.log', files: { 'history.log': 'one\ntwo\nthree\nfour\nfive\nsix\n' }, checks: out('three\nfour\nfive\nsix'),
    },
    {
      title: 'Start at a specific line', focus: 'tail -n +N prints from line N through the end instead of counting backward.',
      example: 'tail -n +3 table.txt', example_output: 'row3\nrow4',
      task: 'Skip the two header lines in export.txt and print every data row.',
      solution: 'tail -n +3 export.txt', files: { 'export.txt': 'Generated report\nname,status\napi,up\ndb,down\nweb,up\n' }, checks: out('api,up\ndb,down\nweb,up'),
    },
    {
      title: 'Read a byte suffix', focus: 'tail -c selects a fixed number of bytes from the end of a file.',
      example: 'tail -c 4 digest.txt', example_output: 'cdef',
      task: 'Print the final six bytes of token.txt.', solution: 'tail -c 6 token.txt', files: { 'token.txt': 'prefix-ABC123' }, checks: out('ABC123', 'The six-byte suffix was printed.', 'exact'),
    },
    {
      title: 'Extract a recent log window', focus: 'tail composes with grep to search only a recent, bounded portion of a large log.',
      example: 'tail -n 100 app.log | grep ERROR', example_output: 'ERROR timeout',
      task: 'Search only the final five lines of app.log and print ERROR rows.',
      solution: 'tail -n 5 app.log | grep ERROR', files: { 'app.log': 'ERROR old\nINFO 1\nINFO 2\nINFO 3\nERROR recent-one\nWARN 4\nERROR recent-two\nINFO 5\n' }, checks: out('ERROR recent-one\nERROR recent-two'),
    },
  ],
  nl: [
    {
      title: 'Number all lines', focus: 'nl -ba numbers every line, including blank separators.',
      example: 'nl -ba notes.txt', example_output: '     1\tone\n     2\t\n     3\ttwo',
      task: 'Number every line in plan.txt, including its blank line.', solution: 'nl -ba plan.txt', files: { 'plan.txt': 'build\n\ntest\n' },
      checks: [{ type: 'stdout-contains', description: 'The blank line consumed number 2.', expected: '3\ttest' }],
    },
    {
      title: 'Choose number width and separator', focus: 'The -w and -s options make line numbers compact and machine-friendly.',
      example: "nl -ba -w2 -s': ' notes.txt", example_output: ' 1: one',
      task: 'Number tasks.txt with width 2 and the separator " | ".',
      solution: "nl -ba -w2 -s' | ' tasks.txt", files: { 'tasks.txt': 'build\ntest\ndeploy\n' }, checks: out(' 1 | build\n 2 | test\n 3 | deploy'),
    },
    {
      title: 'Start numbering at a chosen value', focus: 'The -v option sets the starting number for a numbered stream.',
      example: 'nl -v 101 records.txt', example_output: '   101\tfirst',
      task: 'Number records.txt starting at 501.', solution: 'nl -v 501 records.txt', files: { 'records.txt': 'alpha\nbeta\ngamma\n' },
      checks: [{ type: 'stdout-contains', description: 'The sequence began at 501.', expected: '501\talpha' }, { type: 'stdout-contains', description: 'The sequence advanced to 503.', expected: '503\tgamma' }],
    },
    {
      title: 'Number filtered records', focus: 'A pipeline can filter a dataset first and then assign stable display numbers with nl.',
      example: "grep '^ERROR' app.log | nl -w2 -s'. '", example_output: ' 1. ERROR timeout',
      task: 'Filter failed rows from jobs.csv and number them with width 2 and ") " as the separator.',
      solution: "grep ',failed$' jobs.csv | nl -w2 -s') '", files: { 'jobs.csv': 'api,ok\ndb,failed\nweb,ok\nbackup,failed\n' }, checks: out(' 1) db,failed\n 2) backup,failed'),
    },
  ],
  tac: [
    {
      title: 'Reverse several files as one stream', focus: 'tac processes each supplied file and reverses the records within each file.',
      example: 'tac first.txt second.txt', example_output: 'two\none\nfour\nthree',
      task: 'Reverse a.txt followed by b.txt.', solution: 'tac a.txt b.txt', files: { 'a.txt': 'a1\na2\n', 'b.txt': 'b1\nb2\n' }, checks: out('a2\na1\nb2\nb1'),
    },
    {
      title: 'Use a custom record separator', focus: 'tac -s treats a chosen string as the record separator instead of newline.',
      example: "tac -s, values.txt", example_output: 'three,two,one,',
      task: 'Reverse the pipe-separated records in values.txt.', solution: "tac -s'|' values.txt", files: { 'values.txt': 'alpha|beta|gamma|' }, checks: out('gamma|beta|alpha|', 'The pipe-delimited records were reversed.', 'exact'),
    },
    {
      title: 'Attach separators before records', focus: 'The -b option attaches a separator before each record, useful for formats where delimiters lead fields.',
      example: "tac -b -s: values.txt", example_output: ':three:two:one',
      task: 'Reverse the colon-led records in values.txt while keeping each colon before its record.',
      solution: "tac -b -s: values.txt", files: { 'values.txt': ':one:two:three' }, checks: out(':three:two:one', 'Leading separators were preserved.', 'exact'),
    },
    {
      title: 'Inspect newest records first', focus: 'tac can reverse an append-only log before head selects only the newest few records.',
      example: 'tac events.log | head -n 3', example_output: 'newest\nrecent\nolder',
      task: 'Print the three newest audit records from an oldest-first audit.log.',
      solution: 'tac audit.log | head -n 3', files: { 'audit.log': '09:00 login\n09:10 read\n09:20 write\n09:30 logout\n09:40 login\n' }, checks: out('09:40 login\n09:30 logout\n09:20 write'),
    },
  ],
  strings: [
    {
      title: 'Require a minimum string length', focus: 'strings -n suppresses short runs and prints only text at least the chosen length.',
      example: 'strings -n 8 artifact.bin', example_output: 'LONGVALUE',
      task: 'Print only strings at least eight characters long from artifact.bin.',
      solution: 'strings -n 8 artifact.bin', files: { 'artifact.bin': '\u0000short\u0000ACCESS_TOKEN\u0000tiny\u0000CONFIG_PATH\u0000' }, checks: out('ACCESS_TOKEN\nCONFIG_PATH'),
    },
    {
      title: 'Show decimal offsets', focus: 'strings -t d prefixes each discovered string with its decimal byte offset.',
      example: 'strings -t d sample.bin', example_output: '      4 hello',
      task: 'Print strings from sample.bin with decimal offsets.',
      solution: 'strings -t d sample.bin', files: { 'sample.bin': '\u0000\u0000\u0000\u0000HELLO_WORLD\u0000SECOND_VALUE\u0000' },
      checks: [{ type: 'stdout-contains', description: 'The first embedded string was printed.', expected: 'HELLO_WORLD' }, { type: 'stdout-contains', description: 'The second embedded string was printed.', expected: 'SECOND_VALUE' }],
    },
    {
      title: 'Show hexadecimal offsets', focus: 'strings -t x uses hexadecimal offsets, matching the notation common in binary analysis.',
      example: 'strings -t x sample.bin', example_output: '      10 embedded',
      task: 'Print embedded strings with hexadecimal offsets.',
      solution: 'strings -t x payload.bin', files: { 'payload.bin': '\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000CONFIGURATION\u0000RELEASE_2026\u0000' },
      checks: [{ type: 'stdout-contains', description: 'The configuration string was recovered.', expected: 'CONFIGURATION' }],
    },
    {
      title: 'Search recovered strings', focus: 'Piping strings into grep narrows a binary inspection to meaningful markers without dumping every printable run.',
      example: "strings image.bin | grep '^URL='", example_output: 'URL=https://internal',
      task: 'Recover only KEY=value settings from image.bin.',
      solution: "strings image.bin | grep -E '^[A-Z_]+='", files: { 'image.bin': '\u0000noise\u0000API_URL=http://localhost\u0000version text\u0000RETRY_COUNT=3\u0000' }, checks: out('API_URL=http://localhost\nRETRY_COUNT=3'),
    },
  ],
  od: [
    {
      title: 'Display hexadecimal bytes', focus: 'od -An -tx1 prints raw bytes as two-digit hexadecimal values without address labels.',
      example: "printf 'ABC' | od -An -tx1", example_output: ' 41 42 43',
      task: 'Print the hexadecimal bytes of magic.bin without offsets.',
      solution: 'od -An -tx1 magic.bin', files: { 'magic.bin': 'GIF8' }, checks: out('47 49 46 38', 'The four magic bytes were printed.', 'whitespace'),
    },
    {
      title: 'Display unsigned decimal bytes', focus: 'The -tu1 type renders each byte as an unsigned decimal number.',
      example: "printf 'AZ' | od -An -tu1", example_output: '65 90',
      task: 'Print the unsigned decimal byte values of letters.txt.',
      solution: 'od -An -tu1 letters.txt', files: { 'letters.txt': 'ABC' }, checks: out('65 66 67', 'The decimal byte values were printed.', 'whitespace'),
    },
    {
      title: 'Skip a binary header', focus: 'The -j option skips leading bytes and -N limits how many subsequent bytes are displayed.',
      example: 'od -An -tx1 -j4 -N3 packet.bin', example_output: ' 41 42 43',
      task: 'Skip the four-byte HEAD prefix and print the next four bytes as hex.',
      solution: 'od -An -tx1 -j4 -N4 packet.bin', files: { 'packet.bin': 'HEADDATAtrailer' }, checks: out('44 41 54 41', 'Only the DATA bytes were rendered.', 'whitespace'),
    },
    {
      title: 'Verify a file signature', focus: 'A small od/head pipeline can turn a binary prefix into a compact signature suitable for a validation check.',
      example: "od -An -tx1 -N4 image.bin | tr -d ' \\n'", example_output: '89504e47',
      task: 'Print the first four bytes of artifact.bin as one lowercase hexadecimal signature.',
      solution: "od -An -tx1 -N4 artifact.bin | tr -d ' \\n'", files: { 'artifact.bin': 'PK12payload' }, checks: out('504b3132'),
    },
  ],
  xxd: [
    {
      title: 'Create a compact hex dump', focus: 'xxd -g1 groups output by individual bytes, making exact byte boundaries easy to see.',
      example: "printf 'ABC' | xxd -g1", example_output: '00000000: 41 42 43  ABC',
      task: 'Hex-dump code.bin with one-byte groups.',
      solution: 'xxd -g1 code.bin', files: { 'code.bin': 'ABCD' }, checks: [{ type: 'stdout-contains', description: 'The byte sequence was displayed.', expected: '41 42 43 44' }],
    },
    {
      title: 'Print plain hexadecimal data', focus: 'xxd -p omits addresses and text columns, producing a continuous hexadecimal representation.',
      example: "printf 'Hi' | xxd -p", example_output: '4869',
      task: 'Print payload.txt as plain hexadecimal.', solution: 'xxd -p payload.txt', files: { 'payload.txt': 'CLI' }, checks: out('434c49'),
    },
    {
      title: 'Reverse a plain hex file', focus: 'xxd -r -p converts plain hexadecimal text back into its original bytes.',
      example: "printf '4869' | xxd -r -p", example_output: 'Hi',
      task: 'Decode encoded.hex and print the recovered text.', solution: 'xxd -r -p encoded.hex', files: { 'encoded.hex': '4861636b657220434c492047796d0a' }, checks: out('Hacker CLI Gym'),
    },
    {
      title: 'Patch bytes at a known offset', focus: 'Plain hex plus dd can update a reviewed byte range while leaving the rest of a file intact.',
      example: "printf '4f4b' | xxd -r -p | dd of=status.bin bs=1 seek=4 conv=notrunc", example_output: '',
      task: 'Replace bytes 4-5 of status.bin with OK by decoding 4f4b through xxd, then print the final file.',
      solution: "printf '4f4b' | xxd -r -p | dd of=status.bin bs=1 seek=4 conv=notrunc status=none && cat status.bin", files: { 'status.bin': 'HEADNOEND' }, checks: out('HEADOKEND'),
    },
  ],
  wc: [
    {
      title: 'Count words', focus: 'wc -w counts whitespace-delimited words in a text stream.',
      example: 'wc -w < note.txt', example_output: '4',
      task: 'Print only the number of words in briefing.txt.', solution: 'wc -w < briefing.txt', files: { 'briefing.txt': 'alpha beta\ngamma delta epsilon\n' }, checks: out('5'),
    },
    {
      title: 'Count bytes', focus: 'wc -c reports bytes, which differs from characters for multibyte text.',
      example: 'wc -c < payload.bin', example_output: '12',
      task: 'Print only the byte count of payload.txt.', solution: 'wc -c < payload.txt', files: { 'payload.txt': '1234567890' }, checks: out('10'),
    },
    {
      title: 'Report counts for several files', focus: 'wc labels per-file counts and adds a total when multiple files are supplied.',
      example: 'wc -l one.txt two.txt', example_output: '2 one.txt\n3 two.txt\n5 total',
      task: 'Count lines in api.log and web.log and include the total.',
      solution: 'wc -l api.log web.log', files: { 'api.log': 'a\nb\n', 'web.log': 'c\nd\ne\n' },
      checks: [{ type: 'stdout-contains', description: 'The API count was shown.', expected: '2 api.log' }, { type: 'stdout-contains', description: 'The web count was shown.', expected: '3 web.log' }, { type: 'stdout-contains', description: 'The total was shown.', expected: '5 total' }],
    },
    {
      title: 'Count filtered records', focus: 'wc at the end of a pipeline measures only records selected by earlier stages.',
      example: "grep ',failed$' jobs.csv | wc -l", example_output: '2',
      task: 'Print the number of ERROR records in app.log.',
      solution: "grep '^ERROR' app.log | wc -l", files: { 'app.log': 'INFO start\nERROR timeout\nWARN retry\nERROR unavailable\nERROR aborted\n' }, checks: out('3'),
    },
  ],
};
