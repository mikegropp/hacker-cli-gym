const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];
const exists = (path, kind = 'any', description = `${path} exists.`) => ({ type: 'path-exists', description, path, kind });
const missing = (path, description = `${path} no longer exists.`) => ({ type: 'path-not-exists', description, path });
const content = (path, expected, description = `${path} has the expected content.`) => ({ type: 'file-content', description, path, expected });

export default {
  mkdir: [
    {
      title: 'Create nested parents', focus: 'mkdir -p creates every missing parent and succeeds when directories already exist.',
      example: 'mkdir -p project/src/lib', example_output: '',
      task: 'Create clients/acme/reports in one command.', solution: 'mkdir -p clients/acme/reports',
      checks: [exists('clients/acme/reports', 'directory')],
    },
    {
      title: 'Choose permissions at creation', focus: 'The -m option assigns a directory mode as it is created instead of requiring a later chmod.',
      example: 'mkdir -m 750 private', example_output: '',
      task: 'Create secrets with mode 700.', solution: 'mkdir -m 700 secrets',
      checks: [exists('secrets', 'directory'), { type: 'file-mode', description: 'The directory mode is 700.', path: 'secrets', expected: '700' }],
    },
    {
      title: 'Build a standard project tree', focus: 'Brace expansion combines with mkdir -p to create sibling directories concisely.',
      example: 'mkdir -p app/{src,tests,docs}', example_output: '',
      task: 'Create project/src, project/tests, project/docs, and project/build.',
      solution: 'mkdir -p project/{src,tests,docs,build}', checks: ['src', 'tests', 'docs', 'build'].map(x => exists(`project/${x}`, 'directory')),
    },
    {
      title: 'Create directories from a manifest', focus: 'xargs can feed a reviewed directory manifest to mkdir -p for repeatable setup.',
      example: 'xargs mkdir -p < directories.txt', example_output: '',
      task: 'Read directories.txt and create every listed directory.',
      solution: 'xargs mkdir -p < directories.txt', files: { 'directories.txt': 'services/api/config\nservices/web/public\nvar/cache/app\n' },
      checks: ['services/api/config', 'services/web/public', 'var/cache/app'].map(x => exists(x, 'directory')),
    },
  ],
  rmdir: [
    {
      title: 'Remove several empty directories', focus: 'rmdir accepts multiple empty directory operands and refuses to remove their contents.',
      example: 'rmdir old-a old-b', example_output: '',
      task: 'Remove the empty retired-a and retired-b directories.', solution: 'rmdir retired-a retired-b', directories: ['retired-a', 'retired-b'],
      checks: [missing('retired-a'), missing('retired-b')],
    },
    {
      title: 'Prune empty parent directories', focus: 'rmdir -p removes the named leaf and then each newly empty parent in the same path.',
      example: 'rmdir -p archive/2025/q4', example_output: '',
      task: 'Remove archive/2024/q1 and its now-empty parents.', solution: 'rmdir -p archive/2024/q1', directories: ['archive/2024/q1'],
      checks: [missing('archive')],
    },
    {
      title: 'Ignore non-empty directories safely', focus: '--ignore-fail-on-non-empty lets a cleanup remove empty candidates without treating retained data as an error.',
      example: 'rmdir --ignore-fail-on-non-empty cache logs', example_output: '',
      task: 'Attempt to remove cache and staging, keeping non-empty cache while removing empty staging.',
      solution: 'rmdir --ignore-fail-on-non-empty cache staging', directories: ['staging'], files: { 'cache/keep.txt': 'keep\n' },
      checks: [exists('cache', 'directory'), missing('staging')],
    },
    {
      title: 'Prune empty branches in a tree', focus: 'find -depth can identify empty leaves before rmdir visits their parents, while non-empty branches remain untouched.',
      example: "find tree -depth -type d -empty -exec rmdir {} \\;", example_output: '',
      task: 'Remove every empty directory under workspace while preserving the branch containing keep.txt.',
      solution: "find workspace -depth -type d -empty -exec rmdir {} \\;", directories: ['workspace/tmp/cache', 'workspace/build/old'], files: { 'workspace/data/keep.txt': 'keep\n' },
      checks: [missing('workspace/tmp'), missing('workspace/build'), exists('workspace/data/keep.txt', 'file')],
    },
  ],
  touch: [
    {
      title: 'Create several empty files', focus: 'touch accepts multiple names, making it convenient for scaffolding related files.',
      example: 'touch one.txt two.txt', example_output: '',
      task: 'Create app.log, audit.log, and error.log.', solution: 'touch app.log audit.log error.log',
      checks: ['app.log', 'audit.log', 'error.log'].map(x => exists(x, 'file')),
    },
    {
      title: 'Set a specific timestamp', focus: 'touch -t applies a compact [[CC]YY]MMDDhhmm timestamp for reproducible test fixtures.',
      example: "touch -t 202601020304 sample && date -u -r sample '+%Y-%m-%d %H:%M'", example_output: '2026-01-02 03:04',
      task: 'Set release.marker to 2025-12-31 23:59 UTC and print that timestamp.',
      solution: "TZ=UTC touch -t 202512312359 release.marker && date -u -r release.marker '+%Y-%m-%d %H:%M'", files: { 'release.marker': '' }, checks: out('2025-12-31 23:59'),
    },
    {
      title: 'Copy a reference timestamp', focus: 'touch -r copies access and modification times from a reference file.',
      example: "touch -t 202501010000 reference; touch -r reference target", example_output: '',
      task: 'Give target.txt the same timestamp as source.txt and print same when their epoch modification times match.',
      solution: "touch -t 202402030405 source.txt && touch -r source.txt target.txt && test \"$(stat -c '%Y' source.txt)\" = \"$(stat -c '%Y' target.txt)\" && echo same", files: { 'source.txt': 'source\n', 'target.txt': 'target\n' },
      checks: out('same', 'The target received the reference timestamp.'),
    },
    {
      title: 'Refresh only existing files', focus: 'touch -c updates named files when present but does not accidentally create missing ones.',
      example: 'touch -c existing.log absent.log', example_output: '',
      task: 'Refresh app.log and reference missing.log with -c, without creating missing.log.',
      solution: 'touch -c app.log missing.log', files: { 'app.log': 'existing\n' }, checks: [exists('app.log', 'file'), missing('missing.log')],
    },
  ],
  cp: [
    {
      title: 'Copy a directory tree', focus: 'cp -R recursively copies a directory and all of its descendants.',
      example: 'cp -R template project', example_output: '',
      task: 'Copy template to project, including its nested config file.',
      solution: 'cp -R template project', files: { 'template/README.md': 'template\n', 'template/config/app.ini': 'mode=dev\n' },
      checks: [content('project/README.md', 'template\n'), content('project/config/app.ini', 'mode=dev\n')],
    },
    {
      title: 'Preserve file metadata', focus: 'cp -p preserves mode and timestamps along with file content.',
      example: 'cp -p script.sh backup.sh', example_output: '',
      task: 'Set deploy.sh to mode 750, then copy it to deploy.backup while preserving that mode.',
      solution: 'chmod 750 deploy.sh && cp -p deploy.sh deploy.backup', files: { 'deploy.sh': '#!/bin/sh\n' },
      checks: [content('deploy.backup', '#!/bin/sh\n'), { type: 'file-mode', description: 'The executable mode was preserved.', path: 'deploy.backup', expected: '750' }],
    },
    {
      title: 'Keep numbered destination backups', focus: '--backup=numbered preserves an existing destination before replacing it.',
      example: 'cp --backup=numbered new.conf app.conf', example_output: '',
      task: 'Copy candidate.conf over app.conf while retaining the old app.conf as app.conf.~1~.',
      solution: 'cp --backup=numbered candidate.conf app.conf', files: { 'candidate.conf': 'mode=new\n', 'app.conf': 'mode=old\n' },
      checks: [content('app.conf', 'mode=new\n'), content('app.conf.~1~', 'mode=old\n')],
    },
    {
      title: 'Archive a tree faithfully', focus: 'cp -a preserves a directory hierarchy, modes, timestamps, and symbolic links for a local archive copy.',
      example: 'cp -a release snapshot', example_output: '',
      task: 'Archive release as snapshot while preserving current as a symbolic link.',
      solution: 'cp -a release snapshot && readlink snapshot/current', files: { 'release/v2/app.txt': 'version 2\n' }, symlinks: { 'release/current': 'v2' },
      checks: [content('snapshot/v2/app.txt', 'version 2\n'), ...out('v2', 'The copied link still points to v2.'), exists('snapshot/current')],
      hints: ['Use archive mode rather than recursively dereferencing links.', 'Run cp -a release snapshot; the filesystem checks grade the copy.'],
    },
  ],
  mv: [
    {
      title: 'Move several files into a directory', focus: 'When the final operand is a directory, mv relocates every preceding file into it.',
      example: 'mv one.log two.log archive/', example_output: '',
      task: 'Move api.log, web.log, and db.log into logs/archive.',
      solution: 'mv api.log web.log db.log logs/archive/', directories: ['logs/archive'], files: { 'api.log': 'api\n', 'web.log': 'web\n', 'db.log': 'db\n' },
      checks: ['api', 'web', 'db'].map(x => content(`logs/archive/${x}.log`, `${x}\n`)),
    },
    {
      title: 'Avoid overwriting an existing destination', focus: 'mv -n keeps an existing destination untouched and leaves the source available for review.',
      example: 'mv -n candidate.txt final.txt', example_output: '',
      task: 'Try to move candidate.conf over existing app.conf without overwriting it.',
      solution: 'mv -n candidate.conf app.conf', files: { 'candidate.conf': 'candidate\n', 'app.conf': 'production\n' },
      checks: [content('app.conf', 'production\n'), content('candidate.conf', 'candidate\n')],
    },
    {
      title: 'Back up a replaced destination', focus: 'mv --backup=numbered preserves the prior destination while installing the new file.',
      example: 'mv --backup=numbered new.txt current.txt', example_output: '',
      task: 'Move next.conf to current.conf and retain the old current.conf as current.conf.~1~.',
      solution: 'mv --backup=numbered next.conf current.conf', files: { 'next.conf': 'next\n', 'current.conf': 'current\n' },
      checks: [content('current.conf', 'next\n'), content('current.conf.~1~', 'current\n'), missing('next.conf')],
    },
    {
      title: 'Promote a staged release', focus: 'A sequence of mv operations can archive the current release before promoting a staged directory atomically within one filesystem.',
      example: 'mv current previous && mv staged current', example_output: '',
      task: 'Move release/current to release/previous, then promote release/staged to release/current.',
      solution: 'mv release/current release/previous && mv release/staged release/current', files: { 'release/current/version.txt': 'v1\n', 'release/staged/version.txt': 'v2\n' },
      checks: [content('release/previous/version.txt', 'v1\n'), content('release/current/version.txt', 'v2\n'), missing('release/staged')],
    },
  ],
  rm: [
    {
      title: 'Remove several disposable files', focus: 'rm accepts multiple paths so related disposable files can be removed together.',
      example: 'rm one.tmp two.tmp', example_output: '',
      task: 'Remove cache.tmp, session.tmp, and stale.tmp.', solution: 'rm cache.tmp session.tmp stale.tmp', files: { 'cache.tmp': '', 'session.tmp': '', 'stale.tmp': '' },
      checks: ['cache.tmp', 'session.tmp', 'stale.tmp'].map(x => missing(x)),
    },
    {
      title: 'Remove a disposable directory tree', focus: 'rm -r recursively removes a named tree; it should be scoped to an exact reviewed path.',
      example: 'rm -r build/old', example_output: '',
      task: 'Remove the entire scratch directory while preserving project.',
      solution: 'rm -r scratch', files: { 'scratch/cache/a.tmp': '', 'scratch/cache/b.tmp': '', 'project/keep.txt': 'keep\n' },
      checks: [missing('scratch'), content('project/keep.txt', 'keep\n')],
    },
    {
      title: 'Make cleanup idempotent', focus: 'rm -f does not fail when a file is already absent, which helps repeatable cleanup scripts.',
      example: 'rm -f generated.txt', example_output: '',
      task: 'Remove present.tmp and also name already-gone.tmp without producing an error.',
      solution: 'rm -f present.tmp already-gone.tmp', files: { 'present.tmp': 'temporary\n' },
      checks: [missing('present.tmp'), { type: 'exit-code', description: 'The repeatable cleanup succeeded.', expected: 0 }],
    },
    {
      title: 'Delete files selected by a safe search', focus: 'A null-delimited find/xargs pipeline passes exact filenames to rm without breaking on spaces.',
      example: "find cache -type f -name '*.tmp' -print0 | xargs -0 rm", example_output: '',
      task: 'Delete every .tmp file under cache, including old session.tmp, while preserving .dat files.',
      solution: "find cache -type f -name '*.tmp' -print0 | xargs -0 rm", files: { 'cache/a.tmp': '', 'cache/old session.tmp': '', 'cache/data.dat': 'keep\n', 'cache/nested/b.tmp': '' },
      checks: [missing('cache/a.tmp'), missing('cache/old session.tmp'), missing('cache/nested/b.tmp'), content('cache/data.dat', 'keep\n')],
    },
  ],
  ln: [
    {
      title: 'Create a symbolic link', focus: 'ln -s creates a symbolic link whose stored target can be a relative path.',
      example: 'ln -s releases/v1 current', example_output: '',
      task: 'Create latest as a symbolic link to releases/2026.',
      solution: 'ln -s releases/2026 latest', files: { 'releases/2026/version.txt': '2026\n' },
      checks: [content('latest/version.txt', '2026\n')],
    },
    {
      title: 'Create hard links in a backup directory', focus: 'A hard link gives the same file inode another directory entry without duplicating its data.',
      example: 'ln report.txt backups/report.txt', example_output: '',
      task: 'Create backups/inventory.csv as a hard link to inventory.csv.',
      solution: 'ln inventory.csv backups/inventory.csv', directories: ['backups'], files: { 'inventory.csv': 'router,online\n' },
      checks: [{ type: 'same-inode', description: 'The backup and source share one inode.', path: 'inventory.csv', other_path: 'backups/inventory.csv' }],
    },
    {
      title: 'Create links for several files', focus: 'With a directory destination, ln creates one hard link for each preceding source file.',
      example: 'ln one.txt two.txt snapshots/', example_output: '',
      task: 'Hard-link api.conf, web.conf, and db.conf into snapshots.',
      solution: 'ln api.conf web.conf db.conf snapshots/', directories: ['snapshots'], files: { 'api.conf': 'api\n', 'web.conf': 'web\n', 'db.conf': 'db\n' },
      checks: ['api', 'web', 'db'].map(x => ({ type: 'same-inode', description: `${x}.conf shares its source inode.`, path: `${x}.conf`, other_path: `snapshots/${x}.conf` })),
    },
    {
      title: 'Switch a stable release link', focus: 'ln -sfn replaces an existing symbolic-link destination without copying or moving release data.',
      example: 'ln -sfn releases/v2 current', example_output: '',
      task: 'Switch current from releases/v1 to releases/v2, then print its stored target.',
      solution: 'ln -sfn releases/v2 current && readlink current', files: { 'releases/v1/version': 'v1\n', 'releases/v2/version': 'v2\n' }, symlinks: { current: 'releases/v1' },
      checks: out('releases/v2'),
    },
  ],
  readlink: [
    {
      title: 'Inspect a relative link target', focus: 'readlink prints the target text stored in a symbolic link without resolving it.',
      example: 'readlink current', example_output: 'releases/v1',
      task: 'Print the stored target of latest.', solution: 'readlink latest', files: { 'releases/2026/app': '' }, symlinks: { latest: 'releases/2026' }, checks: out('releases/2026'),
    },
    {
      title: 'Resolve a complete link chain', focus: 'readlink -f follows every link and prints the canonical absolute target.',
      example: 'readlink -f entry', example_output: '/work/releases/v2/app',
      task: 'Resolve entry through active and current to the actual app file.',
      solution: 'readlink -f entry', files: { 'releases/v2/app': 'v2\n' }, symlinks: { current: 'releases/v2', active: 'current', entry: 'active/app' }, checks: out('{{workspace}}/releases/v2/app'),
    },
    {
      title: 'Require every component to exist', focus: 'readlink -e resolves a canonical path only when every component, including the final one, exists.',
      example: 'readlink -e current/config.ini', example_output: '/work/releases/v2/config.ini',
      task: 'Resolve stable/app.conf with -e and print its canonical target.',
      solution: 'readlink -e stable/app.conf', files: { 'versions/blue/app.conf': 'blue\n' }, symlinks: { stable: 'versions/blue' }, checks: out('{{workspace}}/versions/blue/app.conf'),
    },
    {
      title: 'Audit several deployment links', focus: 'A loop around readlink can produce a concise name=target inventory of stable aliases.',
      example: "for link in current backup; do printf '%s=%s\\n' \"$link\" \"$(readlink \"$link\")\"; done", example_output: 'current=releases/v2\nbackup=releases/v1',
      task: 'Print name=target lines for blue, green, and active in that order.',
      solution: "for link in blue green active; do printf '%s=%s\\n' \"$link\" \"$(readlink \"$link\")\"; done", files: { 'releases/blue/version': '', 'releases/green/version': '' }, symlinks: { blue: 'releases/blue', green: 'releases/green', active: 'green' },
      checks: out('blue=releases/blue\ngreen=releases/green\nactive=green'),
    },
  ],
  file: [
    {
      title: 'Identify several file types', focus: 'file accepts multiple paths and reports a type for each.',
      example: 'file note.txt empty.bin', example_output: 'note.txt: ASCII text\nempty.bin: empty',
      task: 'Run file on note.txt and empty.bin.', solution: 'file note.txt empty.bin', files: { 'note.txt': 'hello world\n', 'empty.bin': '' },
      checks: [{ type: 'stdout-contains', description: 'The text file was classified.', expected: 'note.txt:' }, { type: 'stdout-contains', description: 'The empty file was classified.', expected: 'empty.bin: empty' }],
    },
    {
      title: 'Print only MIME types', focus: '--mime-type and -b produce compact media types without filenames or encoding details.',
      example: 'file -b --mime-type note.txt', example_output: 'text/plain',
      task: 'Print only the MIME type of data.csv.', solution: 'file -b --mime-type data.csv', files: { 'data.csv': 'name,status\napi,up\n' }, checks: out('text/plain'),
    },
    {
      title: 'Classify piped content', focus: 'Using - as the path lets file inspect bytes arriving on standard input.',
      example: "printf 'hello\\n' | file -b -", example_output: 'ASCII text',
      task: 'Pipe payload.txt into file and print its brief classification.',
      solution: 'file -b - < payload.txt', files: { 'payload.txt': '{"status":"ok"}\n' }, checks: [{ type: 'stdout-contains', description: 'The piped payload was recognized as text.', expected: 'text' }],
    },
    {
      title: 'Inventory MIME types across a directory', focus: 'A loop can turn file --mime-type into a stable filename=type report for validation workflows.',
      example: "for f in assets/*; do printf '%s=%s\\n' \"$(basename \"$f\")\" \"$(file -b --mime-type \"$f\")\"; done", example_output: 'empty.bin=inode/x-empty\nreadme.txt=text/plain',
      task: 'Print filename=MIME-type lines for assets/empty.bin and assets/readme.txt in sorted filename order.',
      solution: "for f in assets/*; do printf '%s=%s\\n' \"$(basename \"$f\")\" \"$(file -b --mime-type \"$f\")\"; done", files: { 'assets/empty.bin': '', 'assets/readme.txt': 'hello\n' },
      checks: out('empty.bin=inode/x-empty\nreadme.txt=text/plain'),
    },
  ],
  stat: [
    {
      title: 'Print a file size', focus: 'stat -c accepts format tokens; %s expands to the size in bytes.',
      example: "stat -c '%s' note.txt", example_output: '6',
      task: 'Print only the byte size of payload.bin.', solution: "stat -c '%s' payload.bin", files: { 'payload.bin': '1234567890' }, checks: out('10'),
    },
    {
      title: 'Inspect numeric permissions', focus: 'The %a format token prints the familiar octal permission bits.',
      example: "stat -c '%a' script.sh", example_output: '755',
      task: 'Set deploy.sh to mode 750 and print only that numeric mode.',
      solution: "chmod 750 deploy.sh && stat -c '%a' deploy.sh", files: { 'deploy.sh': '#!/bin/sh\n' }, checks: out('750'),
    },
    {
      title: 'Create a compact metadata record', focus: 'Several stat format tokens can produce a parseable name|size|mode record in one call.',
      example: "stat -c '%n|%s|%a' app.conf", example_output: 'app.conf|12|644',
      task: 'Print inventory.csv|18|640 after assigning mode 640.',
      solution: "chmod 640 inventory.csv && stat -c '%n|%s|%a' inventory.csv", files: { 'inventory.csv': 'name,status\napi,up' }, checks: out('inventory.csv|18|640'),
    },
    {
      title: 'Audit a set of deployment files', focus: 'stat can apply one custom format to several files, producing consistent metadata rows.',
      example: "stat -c '%n %s bytes' one.txt two.txt", example_output: 'one.txt 3 bytes\ntwo.txt 5 bytes',
      task: 'Print path:size rows for config/api.conf, config/db.conf, and config/web.conf in that order.',
      solution: "stat -c '%n:%s' config/api.conf config/db.conf config/web.conf", files: { 'config/api.conf': 'api\n', 'config/db.conf': 'database\n', 'config/web.conf': 'web\n' },
      checks: out('config/api.conf:4\nconfig/db.conf:9\nconfig/web.conf:4'),
    },
  ],
};
