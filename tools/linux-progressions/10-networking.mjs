const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];
const content = (path, expected, description = `${path} has the expected content.`) => ({ type: 'file-content', description, path, expected });
const exists = (path, kind = 'file') => ({ type: 'path-exists', description: `${path} exists.`, path, kind });
const missing = path => ({ type: 'path-not-exists', description: `${path} is absent.`, path });

const httpSetup = [
  'pkill -x busybox 2>/dev/null || true',
  'busybox httpd -p 127.0.0.1:8080 -h site',
];

const sshSetup = [
  "pkill -f '[s]shd.*sshd_config' 2>/dev/null || true",
  'mkdir -p /run/sshd',
  "ssh-keygen -q -t ed25519 -N '' -f host_key",
  "ssh-keygen -q -t ed25519 -N '' -f client_key",
  'cp client_key.pub authorized_keys',
  "printf '%s\\n' 'Port 2222' 'ListenAddress 127.0.0.1' 'HostKey /work/host_key' 'PidFile /work/sshd.pid' 'AuthorizedKeysFile /work/authorized_keys' 'PermitRootLogin yes' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'StrictModes no' 'Subsystem sftp internal-sftp' 'LogLevel ERROR' > sshd_config",
  '/usr/sbin/sshd -f /work/sshd_config -E /work/sshd.log',
];

const journalExport = [
  '__CURSOR=s=one',
  '__REALTIME_TIMESTAMP=1767358800000000',
  '_BOOT_ID=11111111111111111111111111111111',
  '_MACHINE_ID=22222222222222222222222222222222',
  'SYSLOG_IDENTIFIER=api',
  'PRIORITY=6',
  'MESSAGE=API started',
  '',
  '__CURSOR=s=two',
  '__REALTIME_TIMESTAMP=1767358860000000',
  '_BOOT_ID=11111111111111111111111111111111',
  '_MACHINE_ID=22222222222222222222222222222222',
  'SYSLOG_IDENTIFIER=db',
  'PRIORITY=3',
  'MESSAGE=Database unavailable',
  '',
  '__CURSOR=s=three',
  '__REALTIME_TIMESTAMP=1767358920000000',
  '_BOOT_ID=11111111111111111111111111111111',
  '_MACHINE_ID=22222222222222222222222222222222',
  'SYSLOG_IDENTIFIER=api',
  'PRIORITY=4',
  'MESSAGE=API retrying',
  '',
  '',
].join('\n');

const journalSetup = [
  'mkdir -p journal',
  '/usr/lib/systemd/systemd-journal-remote --output=journal/gym.journal events.export >/dev/null 2>&1',
];

export default {
  ip: [
    {
      title: 'Inspect link-layer interfaces', focus: 'ip -brief link gives a compact interface, state, and hardware-address summary.',
      example: 'ip -brief link', example_output: 'lo UNKNOWN ...\neth0 UP ...',
      task: 'Print the brief link summary.', solution: 'ip -brief link', checks: [{ type: 'stdout-contains', description: 'The loopback link was included.', expected: 'lo' }],
    },
    {
      title: 'Show one interface in detail', focus: 'A dev selector narrows ip output to one named interface.',
      example: 'ip address show dev lo', example_output: '1: lo: <LOOPBACK,UP,...>',
      task: 'Show address details only for lo.', solution: 'ip address show dev lo', checks: [{ type: 'stdout-contains', description: 'The loopback interface details were printed.', expected: 'LOOPBACK' }, { type: 'stdout-contains', description: 'The IPv4 loopback address was printed.', expected: '127.0.0.1' }],
    },
    {
      title: 'Request JSON interface data', focus: 'ip -j emits structured JSON that jq or another parser can consume safely.',
      example: "ip -j address show dev lo | jq -r '.[0].ifname'", example_output: 'lo',
      task: 'Use JSON ip output and jq to print the lo interface name.',
      solution: "ip -j address show dev lo | jq -r '.[0].ifname'", checks: out('lo'),
    },
    {
      title: 'Create a loopback address report', focus: 'Structured ip JSON lets a workflow select address family and local address without scraping display columns.',
      example: "ip -j addr show lo | jq -r '.[0].addr_info[] | select(.family==\"inet\") | .local'", example_output: '127.0.0.1',
      task: 'Print interface=lo ipv4=127.0.0.1 using ip JSON and jq.',
      solution: "ip -j addr show lo | jq -r '.[0] | \"interface=\\(.ifname) ipv4=\\(.addr_info[] | select(.family==\"inet\") | .local)\"'", checks: out('interface=lo ipv4=127.0.0.1'),
    },
  ],
  ss: [
    {
      title: 'Show all TCP sockets', focus: 'ss -tan includes listening and connected TCP sockets with numeric endpoints.',
      example: 'ss -tan', example_output: 'State Recv-Q Send-Q Local Address:Port ...',
      task: 'Print the numeric TCP socket table.', solution: 'ss -tan', checks: [{ type: 'stdout-contains', description: 'The socket table header was printed.', expected: 'State' }],
    },
    {
      title: 'Inspect a real loopback listener', focus: 'ss -lnt can verify that a TCP service is listening on an expected numeric port.',
      example: "ss -lnt 'sport = :8080'", example_output: 'LISTEN ... 127.0.0.1:8080',
      task: 'Show the loopback HTTP listener on TCP port 8080.',
      solution: "ss -lnt 'sport = :8080'", files: { 'site/index.html': 'ready\n' }, setup: httpSetup, checks: [{ type: 'stdout-contains', description: 'The port 8080 listener was shown.', expected: ':8080' }],
    },
    {
      title: 'Include listening process details', focus: 'ss -p adds the process name and PID associated with a socket when permissions allow.',
      example: 'ss -lntp', example_output: '... users:(("httpd",pid=...))',
      task: 'Print process details for the listener on port 8080.',
      solution: "ss -lntp 'sport = :8080'", files: { 'site/index.html': 'ready\n' }, setup: httpSetup, checks: [{ type: 'stdout-contains', description: 'The listener process details were included.', expected: 'busybox' }],
    },
    {
      title: 'Build a concise listener audit', focus: 'A filtered ss table can feed awk to emit only local endpoints for a monitoring report.',
      example: "ss -lntH | awk '{print $4}'", example_output: '127.0.0.1:8080',
      task: 'Use headerless ss output filtered to port 8080 and print listener=127.0.0.1:8080.',
      solution: "ss -lntH 'sport = :8080' | awk '{print \"listener=\" $4}'", files: { 'site/index.html': 'ready\n' }, setup: httpSetup, checks: out('listener=127.0.0.1:8080'),
    },
  ],
  ping: [
    {
      title: 'Choose the packet count', focus: 'ping -c stops after an exact number of echo requests instead of running continuously.',
      example: 'ping -c 2 127.0.0.1', example_output: '... 2 transmitted, 2 received ...',
      task: 'Send exactly two echo requests to 127.0.0.1.',
      solution: 'ping -c 2 127.0.0.1', checks: [{ type: 'stdout-contains', description: 'Both responses were received.', expected: '2 received' }],
    },
    {
      title: 'Set a response deadline', focus: 'ping -W limits how long each request waits for a reply.',
      example: 'ping -c 1 -W 1 127.0.0.1', example_output: '64 bytes from 127.0.0.1 ...',
      task: 'Send one loopback request with a one-second response timeout.',
      solution: 'ping -c 1 -W 1 127.0.0.1', checks: [{ type: 'stdout-contains', description: 'The loopback reply was received.', expected: '1 received' }],
    },
    {
      title: 'Choose the payload size', focus: 'ping -s sets the ICMP data payload size so a specific packet size can be tested.',
      example: 'ping -c 1 -s 100 127.0.0.1', example_output: '108 bytes from 127.0.0.1 ...',
      task: 'Send one loopback request with a 100-byte payload.',
      solution: 'ping -c 1 -s 100 127.0.0.1', checks: [{ type: 'stdout-contains', description: 'The enlarged reply size was reported.', expected: '108 bytes from' }],
    },
    {
      title: 'Extract packet-loss and latency summaries', focus: 'A bounded ping run produces stable summary lines that can be retained as a connectivity record.',
      example: "ping -c 3 127.0.0.1 | tail -n 2", example_output: '3 packets transmitted...\nrtt min/avg/max...',
      task: 'Send three loopback requests and print only the final packet and RTT summary lines.',
      solution: 'ping -c 3 127.0.0.1 | tail -n 2', checks: [{ type: 'stdout-contains', description: 'Zero packet loss was reported.', expected: '0% packet loss' }, { type: 'stdout-contains', description: 'The RTT summary was included.', expected: 'min/avg/max' }],
    },
  ],
  curl: [
    {
      title: 'Fetch a loopback HTTP resource', focus: 'curl -s retrieves a URL without progress noise while still writing the response body.',
      example: 'curl -s http://127.0.0.1:8080/status.txt', example_output: 'ready',
      task: 'Fetch status.txt from the local HTTP server.',
      solution: 'curl -s http://127.0.0.1:8080/status.txt', files: { 'site/status.txt': 'service=ready\n' }, setup: httpSetup, checks: out('service=ready'),
    },
    {
      title: 'Inspect response headers', focus: 'curl -I requests only HTTP response headers rather than downloading the body.',
      example: 'curl -sI http://127.0.0.1:8080/', example_output: 'HTTP/1.1 200 OK ...',
      task: 'Request headers for index.html and print the HTTP status headers.',
      solution: 'curl -sI http://127.0.0.1:8080/index.html', files: { 'site/index.html': 'home\n' }, setup: httpSetup, checks: [{ type: 'stdout-contains', description: 'A successful HTTP status was returned.', expected: '200 OK' }],
    },
    {
      title: 'Save a response to a chosen file', focus: 'curl -o writes the response body to an explicit destination path.',
      example: 'curl -s -o copy.txt http://127.0.0.1:8080/data.txt', example_output: '',
      task: 'Download artifact.txt to downloads/artifact.copy and print the saved file.',
      solution: 'curl -s -o downloads/artifact.copy http://127.0.0.1:8080/artifact.txt && cat downloads/artifact.copy', directories: ['downloads'], files: { 'site/artifact.txt': 'local artifact\n' }, setup: httpSetup, checks: [content('downloads/artifact.copy', 'local artifact\n'), ...out('local artifact')],
    },
    {
      title: 'Emit a response health record', focus: 'curl -w can print selected transfer metadata separately from a discarded or saved body.',
      example: "curl -s -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\\n' URL", example_output: 'status=200 bytes=6',
      task: 'Fetch health.txt, discard its body, and print status=<code> bytes=<download-size>.',
      solution: "curl -s -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\\n' http://127.0.0.1:8080/health.txt", files: { 'site/health.txt': 'ready\n' }, setup: httpSetup, checks: out('status=200 bytes=6'),
    },
  ],
  wget: [
    {
      title: 'Print a loopback response body', focus: 'wget -qO- suppresses progress and writes the downloaded body to standard output.',
      example: 'wget -qO- http://127.0.0.1:8080/status.txt', example_output: 'ready',
      task: 'Print message.txt from the local HTTP server.',
      solution: 'wget -qO- http://127.0.0.1:8080/message.txt', files: { 'site/message.txt': 'hello from wget\n' }, setup: httpSetup, checks: out('hello from wget'),
    },
    {
      title: 'Save to an explicit destination', focus: 'wget -O chooses the local output path instead of deriving it from the URL.',
      example: 'wget -qO copy.txt http://127.0.0.1:8080/data.txt', example_output: '',
      task: 'Download report.txt as downloads/report.copy and print it.',
      solution: 'wget -qO downloads/report.copy http://127.0.0.1:8080/report.txt && cat downloads/report.copy', directories: ['downloads'], files: { 'site/report.txt': 'wget report\n' }, setup: httpSetup, checks: [content('downloads/report.copy', 'wget report\n'), ...out('wget report')],
    },
    {
      title: 'Check a URL without saving it', focus: 'wget --spider verifies reachability and response status without downloading a response body.',
      example: 'wget -q --spider URL && echo reachable', example_output: 'reachable',
      task: 'Use spider mode on health.txt and print reachable when it succeeds.',
      solution: 'wget -q --spider http://127.0.0.1:8080/health.txt && echo reachable', files: { 'site/health.txt': 'ready\n' }, setup: httpSetup, checks: out('reachable'),
    },
    {
      title: 'Download URLs from a manifest', focus: 'wget -i reads a reviewed URL list and applies the same download behavior to each entry.',
      example: 'wget -q -i urls.txt -P downloads', example_output: '',
      task: 'Download every URL in urls.txt into downloads, then print the filenames in sorted order.',
      solution: 'wget -q -i urls.txt -P downloads && find downloads -type f -printf "%f\n" | sort', directories: ['downloads'], files: { 'site/one.txt': 'one\n', 'site/two.txt': 'two\n', 'urls.txt': 'http://127.0.0.1:8080/one.txt\nhttp://127.0.0.1:8080/two.txt\n' }, setup: httpSetup, checks: out('one.txt\ntwo.txt'),
    },
  ],
  ssh: [
    {
      title: 'Inspect expanded SSH configuration', focus: 'ssh -G prints the final client configuration after defaults, files, and command-line options are combined.',
      example: "ssh -G -p 2222 host | grep -E '^(hostname|port) '", example_output: 'hostname host\nport 2222',
      task: 'Print the effective hostname and port for example.invalid when -p 2200 is supplied.',
      solution: "ssh -G -p 2200 example.invalid | grep -E '^(hostname|port) '", checks: out('hostname example.invalid\nport 2200'),
    },
    {
      title: 'Apply a client configuration alias', focus: 'A Host entry can define hostname, port, user, and identity settings behind a short alias.',
      example: 'ssh -G -F ssh_config lab', example_output: 'host lab\nhostname 127.0.0.1\nport 2222',
      task: 'Use ssh -G with ssh_config and print the effective hostname, user, and port for lab.',
      solution: "ssh -G -F ssh_config lab | grep -E '^(hostname|user|port) '", files: { 'ssh_config': 'Host lab\n  HostName 127.0.0.1\n  User root\n  Port 2222\n' }, checks: [{ type: 'stdout-contains', description: 'The effective host was printed.', expected: 'hostname 127.0.0.1' }, { type: 'stdout-contains', description: 'The effective user was printed.', expected: 'user root' }, { type: 'stdout-contains', description: 'The effective port was printed.', expected: 'port 2222' }],
    },
    {
      title: 'Run a command on a real loopback SSH server', focus: 'SSH can execute one remote command noninteractively while encryption and authentication still occur normally.',
      example: 'ssh lab "printf ready"', example_output: 'ready',
      task: 'Connect to the local SSH server and print remote-ready.',
      solution: "ssh -q -i client_key -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@127.0.0.1 'printf remote-ready'", setup: sshSetup, checks: out('remote-ready'),
    },
    {
      title: 'Collect a structured remote fact', focus: 'Quoting keeps a command on the remote side, while local formatting can label the returned result.',
      example: "value=$(ssh lab 'uname -s'); printf 'remote_kernel=%s\\n' \"$value\"", example_output: 'remote_kernel=Linux',
      task: 'Query uname -s through the local SSH server and print remote_kernel=Linux.',
      solution: "value=$(ssh -q -i client_key -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@127.0.0.1 'uname -s'); printf 'remote_kernel=%s\\n' \"$value\"", setup: sshSetup, checks: out('remote_kernel=Linux'),
    },
  ],
  scp: [
    {
      title: 'Preserve timestamps and modes', focus: 'scp -p preserves modification times, access times, and mode bits during a copy.',
      example: 'scp -p source.txt backup.txt', example_output: '',
      task: 'Set artifact.txt to mode 640, copy it locally to artifact.copy with -p, then print the copy mode.',
      solution: "chmod 640 artifact.txt && scp -p artifact.txt artifact.copy && stat -c '%a' artifact.copy", files: { 'artifact.txt': 'artifact\n' }, checks: [content('artifact.copy', 'artifact\n'), ...out('640')],
    },
    {
      title: 'Copy a directory recursively', focus: 'scp -r copies a directory hierarchy and its files.',
      example: 'scp -r project snapshot', example_output: '',
      task: 'Recursively copy project to snapshot.',
      solution: 'scp -r project snapshot', files: { 'project/README.md': 'project\n', 'project/config/app.ini': 'mode=prod\n' }, checks: [content('snapshot/README.md', 'project\n'), content('snapshot/config/app.ini', 'mode=prod\n')],
    },
    {
      title: 'Upload through a real loopback SSH server', focus: 'An scp destination in user@host:path form transfers data through SSH to a remote filesystem.',
      example: 'scp -P 2222 artifact root@127.0.0.1:/work/uploaded', example_output: '',
      task: 'Upload artifact.txt through the local SSH server to /work/uploaded.txt, then print it.',
      solution: 'scp -q -i client_key -P 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null artifact.txt root@127.0.0.1:/work/uploaded.txt && cat uploaded.txt', files: { 'artifact.txt': 'remote scp\n' }, setup: sshSetup, checks: [content('uploaded.txt', 'remote scp\n'), ...out('remote scp')],
    },
    {
      title: 'Download a remote artifact', focus: 'Reversing scp source and destination downloads a remote path through the authenticated SSH channel.',
      example: 'scp host:/path/artifact downloads/', example_output: '',
      task: 'Download /work/remote/report.txt through the local SSH server to downloads/report.txt and print it.',
      solution: 'scp -q -i client_key -P 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@127.0.0.1:/work/remote/report.txt downloads/report.txt && cat downloads/report.txt', directories: ['downloads'], files: { 'remote/report.txt': 'downloaded report\n' }, setup: sshSetup, checks: [content('downloads/report.txt', 'downloaded report\n'), ...out('downloaded report')],
    },
  ],
  rsync: [
    {
      title: 'Preview changes with a dry run', focus: 'rsync -n reports what would change without writing destination files.',
      example: 'rsync -an source/ destination/', example_output: '... file list ...',
      task: 'Dry-run an archive synchronization from source to destination and print the itemized change list.',
      solution: 'rsync -ani source/ destination/', files: { 'source/one.txt': 'new version\n', 'source/two.txt': 'two\n', 'destination/one.txt': 'old\n' }, checks: [{ type: 'stdout-contains', description: 'The changed first file was reported.', expected: 'one.txt' }, { type: 'stdout-contains', description: 'The missing second file was reported.', expected: 'two.txt' }, missing('destination/two.txt')],
    },
    {
      title: 'Exclude transient files', focus: 'rsync --exclude prevents matching paths from being copied into a synchronized tree.',
      example: "rsync -a --exclude='*.tmp' source/ destination/", example_output: '',
      task: 'Synchronize source to destination while excluding .tmp files.',
      solution: "rsync -a --exclude='*.tmp' source/ destination/", files: { 'source/app.txt': 'app\n', 'source/cache.tmp': 'skip\n', 'source/nested/data.txt': 'data\n' }, checks: [content('destination/app.txt', 'app\n'), content('destination/nested/data.txt', 'data\n'), missing('destination/cache.tmp')],
    },
    {
      title: 'Delete stale destination files', focus: 'rsync --delete removes destination entries absent from the source, making the destination a true mirror.',
      example: 'rsync -a --delete source/ mirror/', example_output: '',
      task: 'Mirror source into destination and remove destination/stale.txt.',
      solution: 'rsync -a --delete source/ destination/', files: { 'source/current.txt': 'current\n', 'destination/current.txt': 'old\n', 'destination/stale.txt': 'stale\n' }, checks: [content('destination/current.txt', 'current\n'), missing('destination/stale.txt')],
    },
    {
      title: 'Create and verify an exact mirror', focus: 'Archive mode, deletion, and checksums combine into a robust local mirror workflow when metadata alone is insufficient.',
      example: 'rsync -ac --delete source/ mirror/', example_output: '',
      task: 'Mirror release into deployed using checksums and deletion, then prove the trees are identical with diff -r.',
      solution: 'rsync -ac --delete release/ deployed/ && diff -r release deployed && echo mirror-verified', files: { 'release/app.bin': 'v2\n', 'release/config/app.ini': 'mode=prod\n', 'deployed/app.bin': 'v1\n', 'deployed/obsolete.txt': 'old\n' }, checks: [content('deployed/app.bin', 'v2\n'), missing('deployed/obsolete.txt'), ...out('mirror-verified')],
    },
  ],
  systemctl: [
    {
      title: 'List installed unit files', focus: 'systemctl list-unit-files reads installed unit definitions even when systemd is not PID 1.',
      example: 'systemctl list-unit-files --type=service --no-pager', example_output: 'UNIT FILE STATE PRESET ...',
      task: 'List service unit files without a pager and print the first five lines.',
      solution: 'systemctl list-unit-files --type=service --no-pager | head -n 5', checks: [{ type: 'stdout-contains', description: 'The unit-file heading was printed.', expected: 'UNIT FILE' }],
    },
    {
      title: 'Check an offline unit state', focus: 'systemctl --root points at an alternate filesystem tree so enablement can be inspected without managing the host.',
      example: 'systemctl --root=/work/rootfs is-enabled gym.service', example_output: 'disabled',
      task: 'Use systemctl with the alternate root to print the disabled state of gym.service.',
      solution: 'systemctl --root=/work/rootfs is-enabled gym.service || true', files: { 'rootfs/etc/systemd/system/gym.service': '[Unit]\nDescription=Gym Practice Service\n[Install]\nWantedBy=multi-user.target\n[Service]\nExecStart=/usr/bin/true\n' }, checks: out('disabled'),
    },
    {
      title: 'Check whether an offline unit is enabled', focus: 'is-enabled with --root evaluates symlink-based enablement in an alternate root without contacting a service manager.',
      example: 'systemctl --root=/work/rootfs is-enabled gym.service', example_output: 'enabled',
      task: 'Enable gym.service in the alternate root, then print its enabled state.',
      solution: 'systemctl --root=/work/rootfs enable gym.service >/dev/null && systemctl --root=/work/rootfs is-enabled gym.service', files: { 'rootfs/etc/systemd/system/gym.service': '[Unit]\nDescription=Gym Practice Service\n[Install]\nWantedBy=multi-user.target\n[Service]\nExecStart=/usr/bin/true\n' }, directories: ['rootfs/etc/systemd/system/multi-user.target.wants'], checks: out('enabled'),
    },
    {
      title: 'Audit selected offline unit properties', focus: 'systemctl show can emit selected machine-readable properties for a unit when a manager is available; offline unit-file commands provide the safe fallback here.',
      example: 'systemctl --root=/work/rootfs list-unit-files gym.service --no-legend', example_output: 'gym.service disabled enabled',
      task: 'List only gym.service from the alternate root without headings or a pager.',
      solution: 'systemctl --root=/work/rootfs list-unit-files gym.service --no-legend --no-pager', files: { 'rootfs/etc/systemd/system/gym.service': '[Unit]\nDescription=Gym Practice Service\n[Install]\nWantedBy=multi-user.target\n[Service]\nExecStart=/usr/bin/true\n' }, checks: [{ type: 'stdout-contains', description: 'The selected unit file was listed.', expected: 'gym.service' }],
    },
  ],
  journalctl: [
    {
      title: 'Read an exported journal file', focus: 'journalctl --file queries a specific journal file without depending on the host journal.',
      example: 'journalctl --file gym.journal --no-pager', example_output: '... API started ...',
      task: 'Print every record from the synthetic gym journal without a pager.',
      solution: 'journalctl --file journal/gym.journal --no-pager', files: { 'events.export': journalExport }, setup: journalSetup, checks: [{ type: 'stdout-contains', description: 'The API startup record was shown.', expected: 'API started' }, { type: 'stdout-contains', description: 'The database failure was shown.', expected: 'Database unavailable' }],
    },
    {
      title: 'Filter by syslog identifier', focus: 'The -t option selects records carrying one SYSLOG_IDENTIFIER value.',
      example: 'journalctl --file gym.journal -t api', example_output: '... API started ...\n... API retrying ...',
      task: 'Print only api records from the synthetic journal.',
      solution: 'journalctl --file journal/gym.journal -t api --no-pager -o cat', files: { 'events.export': journalExport }, setup: journalSetup, checks: out('API started\nAPI retrying'),
    },
    {
      title: 'Filter by priority', focus: 'journalctl -p selects a priority or priority range, such as errors and anything more severe.',
      example: 'journalctl -p err --file gym.journal', example_output: '... Database unavailable ...',
      task: 'Print error-or-higher messages from the synthetic journal in cat format.',
      solution: 'journalctl --file journal/gym.journal -p err --no-pager -o cat', files: { 'events.export': journalExport }, setup: journalSetup, checks: out('Database unavailable'),
    },
    {
      title: 'Export selected journal fields as JSON', focus: 'The json output mode turns each journal entry into structured data that jq can select and reshape.',
      example: "journalctl -o json --file gym.journal | jq -r '.SYSLOG_IDENTIFIER + \"=\" + .MESSAGE'", example_output: 'api=API started',
      task: 'Read the journal as JSON and print identifier=message rows sorted alphabetically.',
      solution: "journalctl --file journal/gym.journal --no-pager -o json | jq -r '.SYSLOG_IDENTIFIER + \"=\" + .MESSAGE' | sort", files: { 'events.export': journalExport }, setup: journalSetup, checks: out('api=API retrying\napi=API started\ndb=Database unavailable'),
    },
  ],
};
