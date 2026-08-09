const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];
const content = (path, expected, description = `${path} has the expected content.`) => ({ type: 'file-content', description, path, expected });
const exists = (path, kind = 'file') => ({ type: 'path-exists', description: `${path} exists.`, path, kind });
const missing = path => ({ type: 'path-not-exists', description: `${path} is absent.`, path });

export default {
  tar: [
    {
      title: 'List archive contents', focus: 'tar -t lists member paths without extracting or changing the workspace.',
      example: 'tar -tf backup.tar', example_output: 'project/\nproject/app.conf',
      task: 'List every member of backup.tar.', solution: 'tar -tf backup.tar', files: { 'source/app.conf': 'mode=prod\n', 'source/docs/readme.txt': 'docs\n' }, setup: ['tar -cf backup.tar source && rm -rf source'],
      checks: [{ type: 'stdout-contains', description: 'The configuration member was listed.', expected: 'source/app.conf' }, { type: 'stdout-contains', description: 'The documentation member was listed.', expected: 'source/docs/readme.txt' }],
    },
    {
      title: 'Create a gzip-compressed archive', focus: 'The -z option compresses the tar stream with gzip while -c creates the archive.',
      example: 'tar -czf project.tar.gz project', example_output: '',
      task: 'Create release.tar.gz from release, then list its members.',
      solution: 'tar -czf release.tar.gz release && tar -tzf release.tar.gz', files: { 'release/bin/app': 'binary\n', 'release/config/app.ini': 'mode=prod\n' },
      checks: [exists('release.tar.gz'), { type: 'stdout-contains', description: 'The application member was archived.', expected: 'release/bin/app' }, { type: 'stdout-contains', description: 'The configuration member was archived.', expected: 'release/config/app.ini' }],
    },
    {
      title: 'Extract one selected member', focus: 'Naming a member after -x extracts only that path instead of the entire archive.',
      example: 'tar -xf backup.tar project/app.conf', example_output: '',
      task: 'Extract only bundle/config/app.conf from bundle.tar.',
      solution: 'tar -xf bundle.tar bundle/config/app.conf', files: { 'bundle/config/app.conf': 'mode=practice\n', 'bundle/data/large.dat': 'do not extract\n' }, setup: ['tar -cf bundle.tar bundle && rm -rf bundle'],
      checks: [content('bundle/config/app.conf', 'mode=practice\n'), missing('bundle/data/large.dat')],
    },
    {
      title: 'Archive a tree while excluding transient files', focus: '--exclude prevents reviewed cache or temporary patterns from entering a release archive.',
      example: "tar --exclude='*.tmp' -czf clean.tar.gz project", example_output: '',
      task: 'Create project.tar.gz from project while excluding every .tmp file, then list the archive.',
      solution: "tar --exclude='*.tmp' -czf project.tar.gz project && tar -tzf project.tar.gz", files: { 'project/src/app.sh': 'echo ready\n', 'project/cache/session.tmp': 'discard\n', 'project/docs/readme.md': 'docs\n' },
      checks: [{ type: 'stdout-contains', description: 'The application was archived.', expected: 'project/src/app.sh' }, { type: 'stdout-contains', description: 'The documentation was archived.', expected: 'project/docs/readme.md' }, { type: 'stdout-not-contains', description: 'No temporary member appears in the listing.', expected: '.tmp' }],
    },
  ],
  gzip: [
    {
      title: 'Keep the original file', focus: 'gzip -k creates the .gz file while retaining the uncompressed source.',
      example: 'gzip -k report.txt', example_output: '',
      task: 'Compress report.txt while keeping report.txt, then verify the compressed stream by printing it.',
      solution: 'gzip -k report.txt && gzip -cd report.txt.gz', files: { 'report.txt': 'alpha\nbeta\n' }, checks: [content('report.txt', 'alpha\nbeta\n'), exists('report.txt.gz'), ...out('alpha\nbeta')],
    },
    {
      title: 'Write compressed data to standard output', focus: 'gzip -c leaves the source alone and sends compressed bytes to standard output for explicit redirection.',
      example: 'gzip -c app.log > app.log.gz', example_output: '',
      task: 'Compress events.log to archive/events.gz with -c while preserving events.log, then print the decompressed archive.',
      solution: 'gzip -c events.log > archive/events.gz && gzip -cd archive/events.gz', directories: ['archive'], files: { 'events.log': 'start\nready\n' }, checks: [content('events.log', 'start\nready\n'), ...out('start\nready')],
    },
    {
      title: 'Use maximum compression', focus: 'gzip -9 spends more CPU to seek a smaller compressed representation.',
      example: 'gzip -9 dataset.txt', example_output: '',
      task: 'Compress dataset.txt with level 9 and print its contents through gzip -cd.',
      solution: 'gzip -9 dataset.txt && gzip -cd dataset.txt.gz', files: { 'dataset.txt': 'repeat repeat repeat repeat repeat\nrepeat repeat repeat repeat repeat\n' }, checks: [missing('dataset.txt'), exists('dataset.txt.gz'), ...out('repeat repeat repeat repeat repeat\nrepeat repeat repeat repeat repeat')],
    },
    {
      title: 'Compress a reviewed batch', focus: 'find with null delimiters can pass exact .log paths to gzip as a safe batch operation.',
      example: "find logs -name '*.log' -print0 | xargs -0 gzip", example_output: '',
      task: 'Compress every .log file below logs while preserving notes.txt, then list the .gz paths.',
      solution: "find logs -type f -name '*.log' -print0 | xargs -0 gzip; find logs -type f -name '*.gz' | sort", files: { 'logs/api.log': 'api\n', 'logs/old web.log': 'web\n', 'logs/notes.txt': 'keep\n' },
      checks: [exists('logs/api.log.gz'), exists('logs/old web.log.gz'), content('logs/notes.txt', 'keep\n'), ...out('logs/api.log.gz\nlogs/old web.log.gz')],
    },
  ],
  gunzip: [
    {
      title: 'Decompress to standard output', focus: 'gunzip -c prints decompressed content while leaving the archive intact.',
      example: 'gunzip -c report.txt.gz', example_output: 'report contents',
      task: 'Print the contents of report.txt.gz without removing the archive.',
      solution: 'gunzip -c report.txt.gz', files: { 'report.txt': 'alpha\nbeta\n' }, setup: ['gzip report.txt'], checks: [exists('report.txt.gz'), ...out('alpha\nbeta')],
    },
    {
      title: 'Test compressed-file integrity', focus: 'gunzip -t validates a gzip stream without producing its uncompressed file.',
      example: 'gunzip -t archive.gz && echo valid', example_output: 'valid',
      task: 'Test payload.gz and print valid-gzip when its stream is intact.',
      solution: 'gunzip -t payload.gz && echo valid-gzip', files: { payload: 'verified payload\n' }, setup: ['gzip payload'], checks: [exists('payload.gz'), ...out('valid-gzip')],
    },
    {
      title: 'Keep the compressed input', focus: 'gunzip -k restores the uncompressed file without deleting the .gz source.',
      example: 'gunzip -k data.txt.gz', example_output: '',
      task: 'Restore data.txt from data.txt.gz while keeping both files.',
      solution: 'gunzip -k data.txt.gz', files: { 'data.txt': 'one\ntwo\n' }, setup: ['gzip data.txt'], checks: [content('data.txt', 'one\ntwo\n'), exists('data.txt.gz')],
    },
    {
      title: 'Restore a batch of log archives', focus: 'gunzip accepts multiple gzip paths and restores each original filename in one reviewed batch.',
      example: 'gunzip logs/a.log.gz logs/b.log.gz', example_output: '',
      task: 'Restore api.log and web.log from their archives, then print both in order.',
      solution: 'gunzip api.log.gz web.log.gz && cat api.log web.log', files: { 'api.log': 'api ready\n', 'web.log': 'web ready\n' }, setup: ['gzip api.log', 'gzip web.log'], checks: [content('api.log', 'api ready\n'), content('web.log', 'web ready\n'), ...out('api ready\nweb ready')],
    },
  ],
  bzip2: [
    {
      title: 'Keep the source while compressing', focus: 'bzip2 -k retains the original file alongside its .bz2 archive.',
      example: 'bzip2 -k report.txt', example_output: '',
      task: 'Compress report.txt with bzip2 while retaining it, then print the archive through bzip2 -cd.',
      solution: 'bzip2 -k report.txt && bzip2 -cd report.txt.bz2', files: { 'report.txt': 'bzip practice\n' }, checks: [content('report.txt', 'bzip practice\n'), exists('report.txt.bz2'), ...out('bzip practice')],
    },
    {
      title: 'Write compressed bytes to stdout', focus: 'bzip2 -c streams compressed data so the destination name and directory remain explicit.',
      example: 'bzip2 -c data.txt > archive/data.bz2', example_output: '',
      task: 'Compress data.txt to backups/data.bz2 while retaining data.txt, then print the decompressed stream.',
      solution: 'bzip2 -c data.txt > backups/data.bz2 && bzip2 -cd backups/data.bz2', directories: ['backups'], files: { 'data.txt': 'backup data\n' }, checks: [content('data.txt', 'backup data\n'), ...out('backup data')],
    },
    {
      title: 'Test bzip2 integrity', focus: 'bzip2 -t validates compressed data without extracting it.',
      example: 'bzip2 -t archive.bz2 && echo valid', example_output: 'valid',
      task: 'Validate artifact.bz2 and print valid-bzip2.',
      solution: 'bzip2 -t artifact.bz2 && echo valid-bzip2', files: { artifact: 'artifact data\n' }, setup: ['bzip2 artifact'], checks: [exists('artifact.bz2'), ...out('valid-bzip2')],
    },
    {
      title: 'Compress a batch at maximum level', focus: 'bzip2 -9 applies its maximum block size to every named file in a reviewed batch.',
      example: 'bzip2 -9 one.log two.log', example_output: '',
      task: 'Compress api.log, db.log, and web.log with -9, then list their archive names.',
      solution: 'bzip2 -9 api.log db.log web.log && printf "%s\n" *.bz2', files: { 'api.log': 'api\n', 'db.log': 'db\n', 'web.log': 'web\n' }, checks: [exists('api.log.bz2'), exists('db.log.bz2'), exists('web.log.bz2'), ...out('api.log.bz2\ndb.log.bz2\nweb.log.bz2')],
    },
  ],
  bunzip2: [
    {
      title: 'Print decompressed data', focus: 'bunzip2 -c sends restored content to stdout while retaining the archive.',
      example: 'bunzip2 -c report.bz2', example_output: 'report',
      task: 'Print report.txt.bz2 without removing it.',
      solution: 'bunzip2 -c report.txt.bz2', files: { 'report.txt': 'bzip report\n' }, setup: ['bzip2 report.txt'], checks: [exists('report.txt.bz2'), ...out('bzip report')],
    },
    {
      title: 'Keep the bzip2 archive', focus: 'bunzip2 -k restores the original file and keeps the compressed input.',
      example: 'bunzip2 -k data.bz2', example_output: '',
      task: 'Restore data.txt from data.txt.bz2 while retaining both.',
      solution: 'bunzip2 -k data.txt.bz2', files: { 'data.txt': 'restored\n' }, setup: ['bzip2 data.txt'], checks: [content('data.txt', 'restored\n'), exists('data.txt.bz2')],
    },
    {
      title: 'Test before extraction', focus: 'bunzip2 -t checks stream integrity without creating output data.',
      example: 'bunzip2 -t data.bz2 && echo safe', example_output: 'safe',
      task: 'Test payload.bz2 and print safe-to-extract.',
      solution: 'bunzip2 -t payload.bz2 && echo safe-to-extract', files: { payload: 'payload\n' }, setup: ['bzip2 payload'], checks: [...out('safe-to-extract'), missing('payload')],
    },
    {
      title: 'Restore several archives', focus: 'bunzip2 can expand several named archives in one consistent operation.',
      example: 'bunzip2 one.txt.bz2 two.txt.bz2', example_output: '',
      task: 'Restore one.txt, two.txt, and three.txt from their .bz2 archives and print them.',
      solution: 'bunzip2 one.txt.bz2 two.txt.bz2 three.txt.bz2 && cat one.txt two.txt three.txt', files: { 'one.txt': 'one\n', 'two.txt': 'two\n', 'three.txt': 'three\n' }, setup: ['bzip2 one.txt', 'bzip2 two.txt', 'bzip2 three.txt'], checks: out('one\ntwo\nthree'),
    },
  ],
  xz: [
    {
      title: 'Keep the source while compressing', focus: 'xz -k retains the source file alongside the .xz stream.',
      example: 'xz -k report.txt', example_output: '',
      task: 'Compress report.txt with xz while keeping it, then print the compressed stream through xz -cd.',
      solution: 'xz -k report.txt && xz -cd report.txt.xz', files: { 'report.txt': 'xz report\n' }, checks: [content('report.txt', 'xz report\n'), exists('report.txt.xz'), ...out('xz report')],
    },
    {
      title: 'Write an xz stream to stdout', focus: 'xz -c allows an explicit destination path and leaves the source unchanged.',
      example: 'xz -c data.txt > archive/data.xz', example_output: '',
      task: 'Compress data.txt to backup/data.xz with -c and print its restored content.',
      solution: 'xz -c data.txt > backup/data.xz && xz -cd backup/data.xz', directories: ['backup'], files: { 'data.txt': 'xz data\n' }, checks: [content('data.txt', 'xz data\n'), ...out('xz data')],
    },
    {
      title: 'Test xz integrity', focus: 'xz -t validates the stream without producing an output file.',
      example: 'xz -t artifact.xz && echo valid', example_output: 'valid',
      task: 'Validate artifact.xz and print valid-xz.',
      solution: 'xz -t artifact.xz && echo valid-xz', files: { artifact: 'artifact\n' }, setup: ['xz artifact'], checks: [...out('valid-xz'), exists('artifact.xz')],
    },
    {
      title: 'Use multithreaded maximum compression', focus: 'xz -T0 can use available cores while -9 selects the strongest normal preset.',
      example: 'xz -T0 -9 dataset.txt', example_output: '',
      task: 'Compress dataset.txt with -T0 -9, then print the restored data.',
      solution: 'xz -T0 -9 dataset.txt && xz -cd dataset.txt.xz', files: { 'dataset.txt': 'repeat repeat repeat repeat\nrepeat repeat repeat repeat\n' }, checks: [exists('dataset.txt.xz'), ...out('repeat repeat repeat repeat\nrepeat repeat repeat repeat')],
    },
  ],
  unxz: [
    {
      title: 'Print restored xz content', focus: 'unxz -c writes decompressed data to stdout and leaves the archive in place.',
      example: 'unxz -c report.txt.xz', example_output: 'report',
      task: 'Print report.txt.xz without removing the archive.',
      solution: 'unxz -c report.txt.xz', files: { 'report.txt': 'unxz report\n' }, setup: ['xz report.txt'], checks: [exists('report.txt.xz'), ...out('unxz report')],
    },
    {
      title: 'Keep the xz input while restoring', focus: 'unxz -k creates the original file and retains its .xz archive.',
      example: 'unxz -k data.txt.xz', example_output: '',
      task: 'Restore data.txt from data.txt.xz and keep the archive.',
      solution: 'unxz -k data.txt.xz', files: { 'data.txt': 'restored xz\n' }, setup: ['xz data.txt'], checks: [content('data.txt', 'restored xz\n'), exists('data.txt.xz')],
    },
    {
      title: 'Test an xz archive before restoring', focus: 'unxz -t performs an integrity check without writing the decompressed file.',
      example: 'unxz -t data.xz && echo safe', example_output: 'safe',
      task: 'Test payload.xz and print safe-to-restore.',
      solution: 'unxz -t payload.xz && echo safe-to-restore', files: { payload: 'payload\n' }, setup: ['xz payload'], checks: [missing('payload'), ...out('safe-to-restore')],
    },
    {
      title: 'Restore a batch of xz archives', focus: 'unxz accepts several archive paths and restores each corresponding source name.',
      example: 'unxz one.xz two.xz', example_output: '',
      task: 'Restore api.log, db.log, and web.log from their xz archives and print them.',
      solution: 'unxz api.log.xz db.log.xz web.log.xz && cat api.log db.log web.log', files: { 'api.log': 'api\n', 'db.log': 'db\n', 'web.log': 'web\n' }, setup: ['xz api.log', 'xz db.log', 'xz web.log'], checks: out('api\ndb\nweb'),
    },
  ],
  zip: [
    {
      title: 'Archive a directory recursively', focus: 'zip -r descends a directory tree and stores its nested files.',
      example: 'zip -r project.zip project', example_output: 'adding: project/...',
      task: 'Create release.zip containing the complete release directory and list its members.',
      solution: 'zip -q -r release.zip release && unzip -Z1 release.zip', files: { 'release/app': 'app\n', 'release/config/app.ini': 'mode=prod\n' }, checks: [{ type: 'stdout-contains', description: 'The application member was archived.', expected: 'release/app' }, { type: 'stdout-contains', description: 'The configuration member was archived.', expected: 'release/config/app.ini' }],
    },
    {
      title: 'Exclude transient patterns', focus: 'zip -x omits matching member paths from an otherwise recursive archive.',
      example: "zip -r project.zip project -x '*.tmp'", example_output: 'adding: ...',
      task: 'Create project.zip recursively while excluding every .tmp file, then list members.',
      solution: "zip -q -r project.zip project -x '*.tmp' && unzip -Z1 project.zip", files: { 'project/src/app.sh': 'app\n', 'project/cache/a.tmp': '', 'project/docs/readme.md': 'docs\n' }, checks: [{ type: 'stdout-contains', description: 'The application was archived.', expected: 'project/src/app.sh' }, { type: 'stdout-contains', description: 'The documentation was archived.', expected: 'project/docs/readme.md' }, { type: 'stdout-not-contains', description: 'No temporary file was archived.', expected: '.tmp' }],
    },
    {
      title: 'Update changed archive members', focus: 'zip -u adds new files and replaces members only when their source is newer.',
      example: 'zip -u bundle.zip app.conf', example_output: 'updating: app.conf',
      task: 'Update bundle.zip after changing app.conf from v1 to v2, then print the archived app.conf.',
      solution: "echo v2 > app.conf && touch -d 'next hour' app.conf && zip -q -u bundle.zip app.conf && unzip -p bundle.zip app.conf", files: { 'app.conf': 'v1\n' }, setup: ['zip -q bundle.zip app.conf'], checks: out('v2'),
    },
    {
      title: 'Build a release archive from a manifest', focus: 'zip -@ reads member names from standard input, allowing a reviewed manifest to define exact archive contents.',
      example: 'zip bundle.zip -@ < manifest.txt', example_output: 'adding: ...',
      task: 'Create bundle.zip using only paths in manifest.txt, then list its members.',
      solution: 'zip -q bundle.zip -@ < manifest.txt && unzip -Z1 bundle.zip', files: { 'manifest.txt': 'app/bin/start.sh\napp/config/app.ini\n', 'app/bin/start.sh': 'start\n', 'app/config/app.ini': 'mode=prod\n', 'app/cache/skip.tmp': 'skip\n' }, checks: out('app/bin/start.sh\napp/config/app.ini'),
    },
  ],
  unzip: [
    {
      title: 'List archive members', focus: 'unzip -l inventories names, sizes, and timestamps without extracting.',
      example: 'unzip -l bundle.zip', example_output: 'Length Date Time Name ...',
      task: 'List the members of bundle.zip.',
      solution: 'unzip -l bundle.zip', files: { 'bundle/app.txt': 'app\n', 'bundle/config.ini': 'mode=prod\n' }, setup: ['zip -q -r bundle.zip bundle && rm -rf bundle'], checks: [{ type: 'stdout-contains', description: 'The application member was listed.', expected: 'bundle/app.txt' }, { type: 'stdout-contains', description: 'The configuration member was listed.', expected: 'bundle/config.ini' }],
    },
    {
      title: 'Print one member without extracting', focus: 'unzip -p streams a selected member directly to standard output.',
      example: 'unzip -p bundle.zip app.conf', example_output: 'mode=prod',
      task: 'Print config/app.ini from bundle.zip without extracting it.',
      solution: 'unzip -p bundle.zip config/app.ini', files: { 'config/app.ini': 'mode=practice\n', 'data/large.dat': 'other\n' }, setup: ['zip -q -r bundle.zip config data && rm -rf config data'], checks: [missing('config/app.ini'), ...out('mode=practice')],
    },
    {
      title: 'Extract one selected member to a directory', focus: 'A member operand and -d destination limit extraction to an exact path and location.',
      example: 'unzip bundle.zip app.conf -d restored', example_output: 'extracting: restored/app.conf',
      task: 'Extract only docs/readme.md from bundle.zip into restored.',
      solution: 'unzip -q bundle.zip docs/readme.md -d restored', files: { 'docs/readme.md': 'documentation\n', 'bin/app': 'skip\n' }, setup: ['zip -q -r bundle.zip docs bin && rm -rf docs bin'], checks: [content('restored/docs/readme.md', 'documentation\n'), missing('restored/bin/app')],
    },
    {
      title: 'Restore an archive without prompts', focus: 'unzip -o overwrites existing destinations without prompting, suitable only after the archive and target are reviewed.',
      example: 'unzip -o release.zip -d current', example_output: 'inflating: current/app.conf',
      task: 'Restore release.zip into current with -o, replacing current/release/app.conf, then print the result.',
      solution: 'unzip -q -o release.zip -d current && cat current/release/app.conf', files: { 'release/app.conf': 'mode=new\n', 'current/release/app.conf': 'mode=old\n' }, setup: ['zip -q -r release.zip release && rm -rf release'], checks: out('mode=new'),
    },
  ],
  sha256sum: [
    {
      title: 'Hash several files', focus: 'sha256sum accepts several paths and prints one digest record for each.',
      example: 'sha256sum one.txt two.txt', example_output: '<hash> one.txt\n<hash> two.txt',
      task: 'Print SHA-256 records for api.conf, db.conf, and web.conf in that order.',
      solution: 'sha256sum api.conf db.conf web.conf', files: { 'api.conf': 'api\n', 'db.conf': 'db\n', 'web.conf': 'web\n' }, checks: [{ type: 'stdout-contains', description: 'The API file was hashed.', expected: 'api.conf' }, { type: 'stdout-contains', description: 'The database file was hashed.', expected: 'db.conf' }, { type: 'stdout-contains', description: 'The web file was hashed.', expected: 'web.conf' }],
    },
    {
      title: 'Create and verify a checksum manifest', focus: 'sha256sum -c reads saved digest records and verifies current file contents.',
      example: 'sha256sum artifact > checksums; sha256sum -c checksums', example_output: 'artifact: OK',
      task: 'Create checksums.sha256 for artifact.bin, then verify it.',
      solution: 'sha256sum artifact.bin > checksums.sha256 && sha256sum -c checksums.sha256', files: { 'artifact.bin': 'verified artifact\n' }, checks: out('artifact.bin: OK'),
    },
    {
      title: 'Report only verification failures', focus: '--quiet suppresses successful OK rows while the exit status still reflects overall verification.',
      example: 'sha256sum -c --quiet checksums && echo verified', example_output: 'verified',
      task: 'Create a manifest for two files, verify it quietly, and print all-verified.',
      solution: 'sha256sum one.txt two.txt > checksums.sha256 && sha256sum -c --quiet checksums.sha256 && echo all-verified', files: { 'one.txt': 'one\n', 'two.txt': 'two\n' }, checks: out('all-verified'),
    },
    {
      title: 'Detect a changed artifact', focus: 'A checksum manifest detects content changes independently of filename or timestamp metadata.',
      example: 'sha256sum file > manifest; echo changed > file; sha256sum -c manifest', example_output: 'file: FAILED',
      task: 'Create a checksum for config.ini, change its contents, then run verification and preserve the FAILED output.',
      solution: "sha256sum config.ini > checksums.sha256; echo 'mode=changed' > config.ini; sha256sum -c checksums.sha256 || true", files: { 'config.ini': 'mode=original\n' }, checks: [{ type: 'stdout-contains', description: 'The changed file failed verification.', expected: 'config.ini: FAILED' }],
    },
  ],
};
