const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];
const mode = (path, expected, description = `${path} has mode ${expected}.`) => ({ type: 'file-mode', description, path, expected });
const owner = (path, other_path, description = `${path} has the reference owner.`) => ({ type: 'same-owner', description, path, other_path });
const group = (path, other_path, description = `${path} has the reference group.`) => ({ type: 'same-group', description, path, other_path });

const sessionDump = [
  '[7] [01001] [pts/0       ] [alice   ] [pts/0       ] [10.0.0.10          ] [10.0.0.10     ] [2026-01-02T09:00:00,000000+00:00]',
  '[7] [01002] [pts/1       ] [bob     ] [pts/1       ] [10.0.0.11          ] [10.0.0.11     ] [2026-01-02T09:05:00,000000+00:00]',
  '[7] [01003] [pts/2       ] [alice   ] [pts/2       ] [10.0.0.12          ] [10.0.0.12     ] [2026-01-02T09:10:00,000000+00:00]',
].join('\n') + '\n';

export default {
  chmod: [
    {
      title: 'Add execute permission symbolically', focus: 'Symbolic modes such as u+x modify selected permission bits without replacing the others.',
      example: 'chmod u+x script.sh', example_output: '',
      task: 'Add execute permission for the owner of deploy.sh while keeping its other bits.',
      solution: 'chmod u+x deploy.sh', files: { 'deploy.sh': '#!/bin/sh\n' }, checks: [mode('deploy.sh', '744')],
    },
    {
      title: 'Assign different permissions by class', focus: 'A comma-separated symbolic mode can set owner, group, and other permissions in one operation.',
      example: 'chmod u=rw,g=r,o= config.ini', example_output: '',
      task: 'Set app.conf so the owner can read/write, the group can read, and others have no access.',
      solution: 'chmod u=rw,g=r,o= app.conf', files: { 'app.conf': 'secret=true\n' }, checks: [mode('app.conf', '640')],
    },
    {
      title: 'Change a tree recursively', focus: 'chmod -R applies a mode through a directory tree; use it only on a precisely scoped path.',
      example: 'chmod -R go-rwx private', example_output: '',
      task: 'Recursively remove all group and other permissions from private.',
      solution: 'chmod -R go-rwx private', files: { 'private/one.txt': 'one\n', 'private/nested/two.txt': 'two\n' },
      checks: [mode('private/one.txt', '600'), mode('private/nested/two.txt', '600')],
    },
    {
      title: 'Apply a reference permission model', focus: 'chmod --reference copies exact mode bits from a reviewed template file.',
      example: 'chmod --reference=template.sh deploy.sh', example_output: '',
      task: 'Set template.sh to 750, then apply its permissions to api.sh, web.sh, and worker.sh.',
      solution: 'chmod 750 template.sh && chmod --reference=template.sh api.sh web.sh worker.sh', files: { 'template.sh': '', 'api.sh': '', 'web.sh': '', 'worker.sh': '' },
      checks: ['api.sh', 'web.sh', 'worker.sh'].map(path => mode(path, '750')),
    },
  ],
  chown: [
    {
      title: 'Change a file owner by name', focus: 'chown accepts an account name and resolves it through the local user database.',
      example: 'chown nobody artifact.txt', example_output: '',
      task: 'Change artifact.txt owner to nobody and print its owner name.',
      solution: "chown nobody artifact.txt && stat -c '%U' artifact.txt", files: { 'artifact.txt': 'data\n' }, checks: out('nobody'),
    },
    {
      title: 'Change owner and group together', focus: 'The owner:group form updates both ownership fields in one chown operation.',
      example: 'chown nobody:nogroup cache.dat', example_output: '',
      task: 'Change cache.dat to owner nobody and group nogroup, then print owner:group.',
      solution: "chown nobody:nogroup cache.dat && stat -c '%U:%G' cache.dat", files: { 'cache.dat': '' }, checks: out('nobody:nogroup'),
    },
    {
      title: 'Apply ownership recursively', focus: 'chown -R updates descendants throughout a precisely named directory tree.',
      example: 'chown -R nobody:nogroup shared', example_output: '',
      task: 'Recursively assign nobody:nogroup to every file under shared.',
      solution: 'chown -R nobody:nogroup shared', files: { 'shared/a.txt': '', 'shared/nested/b.txt': '' },
      checks: [owner('shared/a.txt', 'shared/nested/b.txt'), group('shared/a.txt', 'shared/nested/b.txt'), ...out('', 'Ownership changes completed.', 'exact')],
    },
    {
      title: 'Restrict changes to an expected owner', focus: 'chown --from changes an item only when its current owner and group match an expected state.',
      example: 'chown --from=root:root nobody:nogroup file.txt', example_output: '',
      task: 'Use --from=root:root to change approved.txt to nobody:nogroup while leaving already-nobody.txt unchanged, then print both owners.',
      solution: "chown nobody:nogroup already-nobody.txt && chown --from=root:root nobody:nogroup approved.txt already-nobody.txt && stat -c '%n=%U:%G' approved.txt already-nobody.txt", files: { 'approved.txt': '', 'already-nobody.txt': '' },
      checks: out('approved.txt=nobody:nogroup\nalready-nobody.txt=nobody:nogroup'),
    },
  ],
  chgrp: [
    {
      title: 'Change a file group by name', focus: 'chgrp resolves a group name and assigns that group without changing the owner.',
      example: 'chgrp nogroup report.txt', example_output: '',
      task: 'Change report.txt group to nogroup and print its group name.',
      solution: "chgrp nogroup report.txt && stat -c '%G' report.txt", files: { 'report.txt': '' }, checks: out('nogroup'),
    },
    {
      title: 'Change several files together', focus: 'chgrp accepts multiple paths so a reviewed batch can receive one group consistently.',
      example: 'chgrp nogroup one.txt two.txt', example_output: '',
      task: 'Assign nogroup to api.conf, db.conf, and web.conf, then print each name:group.',
      solution: "chgrp nogroup api.conf db.conf web.conf && stat -c '%n:%G' api.conf db.conf web.conf", files: { 'api.conf': '', 'db.conf': '', 'web.conf': '' }, checks: out('api.conf:nogroup\ndb.conf:nogroup\nweb.conf:nogroup'),
    },
    {
      title: 'Apply group ownership recursively', focus: 'chgrp -R updates every descendant under one carefully scoped directory.',
      example: 'chgrp -R nogroup shared', example_output: '',
      task: 'Recursively assign group nogroup to files below shared.',
      solution: 'chgrp -R nogroup shared', files: { 'shared/one.txt': '', 'shared/nested/two.txt': '' }, checks: [
        { type: 'same-group', description: 'Both shared files received one group.', path: 'shared/one.txt', other_path: 'shared/nested/two.txt' },
      ],
    },
    {
      title: 'Mirror a reference group across artifacts', focus: 'chgrp --reference copies the group from a reviewed reference to one or more targets.',
      example: 'chgrp --reference=template one two', example_output: '',
      task: 'Set template group to nogroup, then copy that group to release.tar, checksums.txt, and manifest.json.',
      solution: 'chgrp nogroup template && chgrp --reference=template release.tar checksums.txt manifest.json', files: { template: '', 'release.tar': '', 'checksums.txt': '', 'manifest.json': '' },
      checks: ['release.tar', 'checksums.txt', 'manifest.json'].map(path => group(path, 'template')),
    },
  ],
  umask: [
    {
      title: 'Read the symbolic mask', focus: 'umask -S expresses the effective creation permissions symbolically instead of as removed octal bits.',
      example: 'umask 027; umask -S', example_output: 'u=rwx,g=rx,o=',
      task: 'Set umask 027 and print it in symbolic form.', solution: 'umask 027 && umask -S', checks: out('u=rwx,g=rx,o='),
    },
    {
      title: 'Create a group-readable file', focus: 'A 027 mask produces regular files with mode 640 from the normal 666 creation base.',
      example: 'umask 027; touch shared.txt', example_output: '',
      task: 'Set umask 027 and create shared.txt.', solution: 'umask 027 && touch shared.txt', checks: [mode('shared.txt', '640')],
    },
    {
      title: 'Compare file and directory defaults', focus: 'The same umask applies to different creation bases: files begin at 666 and directories at 777.',
      example: 'umask 027; touch file; mkdir dir', example_output: '',
      task: 'With umask 027, create report.txt and reports, then print their numeric modes.',
      solution: "umask 027 && touch report.txt && mkdir reports && stat -c '%a' report.txt reports", checks: out('640\n750'),
    },
    {
      title: 'Limit a restrictive mask to a subshell', focus: 'A subshell contains a temporary umask so later commands in the parent shell retain their normal default.',
      example: '(umask 077; touch private); touch public', example_output: '',
      task: 'Create private.txt with mask 077 in a subshell, then create normal.txt with the gym default, and print both modes.',
      solution: "(umask 077; touch private.txt); touch normal.txt; stat -c '%a' private.txt normal.txt", checks: out('600\n644'),
    },
  ],
  id: [
    {
      title: 'Print the effective username', focus: 'id -un combines the user-only and name-output options.',
      example: 'id -un', example_output: 'root',
      task: 'Print only your effective user name with id.', solution: 'id -un', checks: out('root'),
    },
    {
      title: 'Inspect a named account', focus: 'Passing a username queries that account rather than the current process identity.',
      example: 'id nobody', example_output: 'uid=65534(nobody) gid=65534(nogroup) groups=65534(nogroup)',
      task: 'Print the identity record for nobody.', solution: 'id nobody', checks: [{ type: 'stdout-contains', description: 'The nobody account was identified.', expected: 'nobody' }, { type: 'stdout-contains', description: 'Its primary group was included.', expected: 'nogroup' }],
    },
    {
      title: 'Print group names only', focus: 'id -Gn lists supplementary and primary group names without numeric IDs.',
      example: 'id -Gn nobody', example_output: 'nogroup',
      task: 'Print only the group names for nobody.', solution: 'id -Gn nobody', checks: out('nogroup'),
    },
    {
      title: 'Build a compact identity record', focus: 'Several focused id queries can be composed into a stable user, UID, group, and GID report.',
      example: "printf 'user=%s uid=%s\\n' \"$(id -un)\" \"$(id -u)\"", example_output: 'user=root uid=0',
      task: 'Print user=root uid=0 group=root gid=0 using id substitutions.',
      solution: "printf 'user=%s uid=%s group=%s gid=%s\\n' \"$(id -un)\" \"$(id -u)\" \"$(id -gn)\" \"$(id -g)\"", checks: out('user=root uid=0 group=root gid=0'),
    },
  ],
  whoami: [
    {
      title: 'Verify the expected account', focus: 'whoami output can be compared in a conditional before a privileged or account-specific workflow continues.',
      example: "if [ \"$(whoami)\" = root ]; then echo ready; fi", example_output: 'ready',
      task: 'Use whoami in a conditional and print root-session when running as root.',
      solution: 'if [ "$(whoami)" = root ]; then echo root-session; fi', checks: out('root-session'),
    },
    {
      title: 'Compare two identity commands', focus: 'whoami and id -un should agree on the effective account, providing a simple sanity check.',
      example: '[ "$(whoami)" = "$(id -un)" ] && echo match', example_output: 'match',
      task: 'Compare whoami with id -un and print identities-match when equal.',
      solution: '[ "$(whoami)" = "$(id -un)" ] && echo identities-match', checks: out('identities-match'),
    },
    {
      title: 'Observe identity under another account', focus: 'runuser can execute whoami under a selected local account in this disposable root container.',
      example: 'runuser -u nobody -- whoami', example_output: 'nobody',
      task: 'Run whoami as nobody and print the resulting effective username.',
      solution: 'runuser -u nobody -- whoami', checks: out('nobody'),
    },
    {
      title: 'Record the operator in an audit entry', focus: 'Command substitution inserts the effective username into a timestamp-independent audit record.',
      example: "printf 'operator=%s action=test\\n' \"$(whoami)\"", example_output: 'operator=root action=test',
      task: 'Write operator=<whoami> action=deploy to audit.log and print the same line.',
      solution: "printf 'operator=%s action=deploy\\n' \"$(whoami)\" | tee audit.log", checks: [...out('operator=root action=deploy'), { type: 'file-content', description: 'The audit entry was saved.', path: 'audit.log', expected: 'operator=root action=deploy\n' }],
    },
  ],
  groups: [
    {
      title: 'Inspect another account groups', focus: 'groups accepts a username and reports that account rather than only the current identity.',
      example: 'groups nobody', example_output: 'nobody : nogroup',
      task: 'Print group membership for nobody.', solution: 'groups nobody', checks: [{ type: 'stdout-contains', description: 'The nogroup membership was shown.', expected: 'nogroup' }],
    },
    {
      title: 'Print group names one per line', focus: 'Shell word splitting can turn the compact groups output into a line-oriented stream for later tools.',
      example: 'groups | tr " " "\\n"', example_output: 'root',
      task: 'Print the current account groups one per line.', solution: "groups | tr ' ' '\\n'", checks: out('root'),
    },
    {
      title: 'Test membership in a required group', focus: 'A group list can be searched exactly before a workflow assumes group-based access.',
      example: "groups | tr ' ' '\\n' | grep -qx root && echo member", example_output: 'member',
      task: 'Use groups to verify membership in root and print root-member.',
      solution: "groups | tr ' ' '\\n' | grep -qx root && echo root-member", checks: out('root-member'),
    },
    {
      title: 'Build an account-to-groups report', focus: 'A loop around groups can inventory memberships for several named accounts.',
      example: 'for u in root nobody; do groups "$u"; done', example_output: 'root : root\nnobody : nogroup',
      task: 'Print groups reports for root and nobody in that order.',
      solution: 'for user in root nobody; do groups "$user"; done', checks: [{ type: 'stdout-contains', description: 'The root report was included.', expected: 'root : root' }, { type: 'stdout-contains', description: 'The nobody report was included.', expected: 'nobody : nogroup' }],
    },
  ],
  getent: [
    {
      title: 'Query a group database entry', focus: 'The group database returns a colon-delimited record for a named group.',
      example: 'getent group root', example_output: 'root:x:0:',
      task: 'Query the group database for nogroup.', solution: 'getent group nogroup', checks: [{ type: 'stdout-contains', description: 'The nogroup database row was returned.', expected: 'nogroup:' }],
    },
    {
      title: 'Resolve a service name and protocol', focus: 'The services database maps well-known names and protocols to port numbers.',
      example: 'getent services ssh/tcp', example_output: 'ssh 22/tcp',
      task: 'Look up HTTP in the services database and print the record.', solution: 'getent services http', checks: [{ type: 'stdout-contains', description: 'The HTTP port mapping was returned.', expected: '80/tcp' }],
    },
    {
      title: 'Resolve a host through NSS', focus: 'getent hosts uses the system name-service switch rather than hard-coding a particular resolver source.',
      example: 'getent hosts localhost', example_output: '::1 localhost ...',
      task: 'Resolve localhost with getent hosts.', solution: 'getent hosts localhost', checks: [{ type: 'stdout-contains', description: 'The localhost record was returned.', expected: 'localhost' }],
    },
    {
      title: 'Create a local account summary', focus: 'getent passwd provides structured account rows that awk can filter and format for an audit.',
      example: "getent passwd | awk -F: '$3 < 10 {print $1 \"=\" $3}'", example_output: 'root=0',
      task: 'Query root and nobody and print username=uid:shell rows in that order.',
      solution: "getent passwd root nobody | awk -F: '{print $1 \"=\" $3 \":\" $7}'", checks: [{ type: 'stdout-contains', description: 'The root UID and shell were summarized.', expected: 'root=0:/bin/bash' }, { type: 'stdout-contains', description: 'The nobody account was summarized.', expected: 'nobody=65534:' }],
    },
  ],
  users: [
    {
      title: 'Read users from a login-record file', focus: 'users accepts an alternate utmp-format file, which makes historical or captured session data inspectable.',
      example: 'users sessions.utmp', example_output: 'alice bob',
      task: 'Convert sessions.dump to sessions.utmp with utmpdump, then list its logged-in users.',
      solution: 'utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && users sessions.utmp', files: { 'sessions.dump': sessionDump }, checks: out('alice alice bob'),
    },
    {
      title: 'Count active login records', focus: 'Because users emits one whitespace-delimited name per session, wc -w counts sessions directly.',
      example: 'users sessions.utmp | wc -w', example_output: '3',
      task: 'Build sessions.utmp and print its number of active login sessions.',
      solution: 'utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && users sessions.utmp | wc -w', files: { 'sessions.dump': sessionDump }, checks: out('3'),
    },
    {
      title: 'List unique logged-in names', focus: 'users sorts its output; translating spaces to lines and uniq removes repeated sessions for one account.',
      example: "users sessions.utmp | tr ' ' '\\n' | uniq", example_output: 'alice\nbob',
      task: 'Build sessions.utmp and print each distinct logged-in username once.',
      solution: "utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && users sessions.utmp | tr ' ' '\\n' | uniq", files: { 'sessions.dump': sessionDump }, checks: out('alice\nbob'),
    },
    {
      title: 'Create a session-count summary by user', focus: 'A users stream becomes a per-account session report after converting it to lines and counting adjacent names.',
      example: "users sessions.utmp | tr ' ' '\\n' | uniq -c", example_output: '2 alice\n1 bob',
      task: 'Build sessions.utmp and print username=session-count rows sorted by username.',
      solution: "utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && users sessions.utmp | tr ' ' '\\n' | uniq -c | awk '{print $2 \"=\" $1}'", files: { 'sessions.dump': sessionDump }, checks: out('alice=2\nbob=1'),
    },
  ],
  who: [
    {
      title: 'Read detailed login records from a file', focus: 'who accepts an alternate utmp-format file and prints a row per session.',
      example: 'who sessions.utmp', example_output: 'alice pts/0 2026-01-02 09:00 (10.0.0.10)',
      task: 'Build sessions.utmp from sessions.dump and display its session records with who.',
      solution: 'utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && who sessions.utmp', files: { 'sessions.dump': sessionDump },
      checks: [{ type: 'stdout-contains', description: 'Alice login records were shown.', expected: 'alice' }, { type: 'stdout-contains', description: 'Bob login records were shown.', expected: 'bob' }],
    },
    {
      title: 'Add a heading row', focus: 'who -H labels the user, line, time, and comment columns for a readable report.',
      example: 'who -H sessions.utmp', example_output: 'NAME LINE TIME COMMENT\nalice pts/0 ...',
      task: 'Build sessions.utmp and print who output with column headings.',
      solution: 'utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && who -H sessions.utmp', files: { 'sessions.dump': sessionDump }, checks: [{ type: 'stdout-contains', description: 'The NAME heading was printed.', expected: 'NAME' }],
    },
    {
      title: 'Print a quick user count', focus: 'who -q emits a compact username list and a final count.',
      example: 'who -q sessions.utmp', example_output: 'alice bob alice\n# users=3',
      task: 'Build sessions.utmp and use who -q to print its names and total session count.',
      solution: 'utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && who -q sessions.utmp', files: { 'sessions.dump': sessionDump }, checks: [{ type: 'stdout-contains', description: 'The session total was reported.', expected: '# users=3' }],
    },
    {
      title: 'Summarize sessions by remote host', focus: 'who provides structured session rows that awk can reshape into a concise user=terminal@host audit.',
      example: "who sessions.utmp | awk '{print $1 \"=\" $2 \"@\" $5}'", example_output: 'alice=pts/0@(10.0.0.10)',
      task: 'Build sessions.utmp and print user=terminal@host for every session.',
      solution: "utmpdump -r sessions.dump > sessions.utmp 2>/dev/null && who sessions.utmp | awk '{print $1 \"=\" $2 \"@\" $5}'", files: { 'sessions.dump': sessionDump },
      checks: [{ type: 'stdout-contains', description: 'Alice terminal data was summarized.', expected: 'alice=pts/0@' }, { type: 'stdout-contains', description: 'Bob terminal data was summarized.', expected: 'bob=pts/1@' }],
    },
  ],
};
