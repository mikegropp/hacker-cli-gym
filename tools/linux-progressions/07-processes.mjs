const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];

export default {
  ps: [
    {
      title: 'Choose process columns', focus: 'ps -o selects and orders only the fields needed for a process report.',
      example: 'ps -o pid,ppid,comm -p 1', example_output: 'PID PPID COMMAND\n1 0 gym',
      task: 'Print PID, PPID, and command for process 1 with headers.',
      solution: 'ps -o pid,ppid,comm -p 1', checks: [{ type: 'stdout-contains', description: 'The PID heading was shown.', expected: 'PID' }, { type: 'stdout-contains', description: 'Process 1 was included.', expected: '1' }],
    },
    {
      title: 'Inspect a process you started', focus: 'A saved $! PID lets ps inspect one exact background process without broad matching.',
      example: "sleep 30 & pid=$!; ps -o pid=,comm= -p \"$pid\"; kill \"$pid\"", example_output: '123 sleep',
      task: 'Start sleep 30 in the background, print its PID and command with ps without headers, then stop it.',
      solution: 'sleep 30 & pid=$!; ps -o pid=,comm= -p "$pid"; kill "$pid"', checks: [{ type: 'stdout-contains', description: 'The sleep command was identified.', expected: 'sleep' }],
    },
    {
      title: 'Sort processes by memory use', focus: 'ps --sort orders a custom process table by a selected field such as resident memory.',
      example: 'ps -eo pid,comm,rss --sort=-rss | head', example_output: 'PID COMMAND RSS\n...',
      task: 'Print the header and five process rows sorted by descending RSS.',
      solution: 'ps -eo pid,comm,rss --sort=-rss | head -n 6', checks: [{ type: 'stdout-contains', description: 'The RSS column was included.', expected: 'RSS' }],
    },
    {
      title: 'Create a filtered process inventory', focus: 'A custom ps table can feed awk so a workflow retains only rows matching a command name.',
      example: "ps -eo pid=,comm= | awk '$2==\"sleep\"'", example_output: '123 sleep',
      task: 'Start a background sleep, use ps and awk to print only PID=sleep for that PID, then stop it.',
      solution: "sleep 30 & pid=$!; ps -o pid=,comm= -p \"$pid\" | awk '{print $1 \"=\" $2}'; kill \"$pid\"", checks: [{ type: 'stdout-regex', description: 'The process inventory row was formatted.', expected: '[0-9]+=sleep' }],
    },
  ],
  top: [
    {
      title: 'Capture one noninteractive sample', focus: 'Batch mode -b and one iteration -n 1 make top usable in scripts and logs.',
      example: 'top -b -n 1 | head', example_output: 'top - ...\nTasks: ...',
      task: 'Capture the first ten lines from one batch-mode top sample.',
      solution: 'top -b -n 1 | head -n 10', checks: [{ type: 'stdout-contains', description: 'The task summary was captured.', expected: 'Tasks:' }],
    },
    {
      title: 'Monitor one selected PID', focus: 'top -p restricts the display to one process ID instead of the whole system.',
      example: 'top -b -n 1 -p 1', example_output: '... PID USER ...',
      task: 'Capture one batch-mode top sample restricted to process 1.',
      solution: 'top -b -n 1 -p 1', checks: [{ type: 'stdout-contains', description: 'The process table header was printed.', expected: 'PID' }],
    },
    {
      title: 'Sort a process snapshot by CPU', focus: 'The -o field option changes how top orders its process rows in batch output.',
      example: 'top -b -n 1 -o %CPU | head -n 12', example_output: '... PID USER ... %CPU ...',
      task: 'Capture the first twelve lines of one top sample sorted by descending CPU use.',
      solution: 'top -b -n 1 -o %CPU | head -n 12', checks: [{ type: 'stdout-contains', description: 'The process table PID heading was included.', expected: 'PID' }, { type: 'stdout-contains', description: 'The CPU column was included.', expected: '%CPU' }],
    },
    {
      title: 'Extract selected system metrics', focus: 'A top batch snapshot can be filtered into just the task, CPU, and memory summaries needed for a health record.',
      example: "top -b -n 1 | grep -E '^(Tasks|%Cpu|MiB Mem)'", example_output: 'Tasks: ...\n%Cpu(s): ...\nMiB Mem : ...',
      task: 'Capture one top sample and print only its Tasks, CPU, and memory summary lines.',
      solution: "top -b -n 1 | grep -E '^(Tasks|%Cpu|MiB Mem)'", checks: [{ type: 'stdout-contains', description: 'The task summary was included.', expected: 'Tasks:' }, { type: 'stdout-contains', description: 'The memory summary was included.', expected: 'MiB Mem' }],
    },
  ],
  pgrep: [
    {
      title: 'Match an exact process name', focus: 'pgrep -x requires the entire process name to match instead of accepting a substring.',
      example: 'pgrep -x bash', example_output: '123',
      task: 'Start sleep 30, use pgrep -x sleep to print a matching PID, then stop the process.',
      solution: 'sleep 30 & pid=$!; pgrep -x sleep; kill "$pid"', checks: [{ type: 'stdout-regex', description: 'A numeric sleep PID was printed.', expected: '[0-9]+' }],
    },
    {
      title: 'Print PID and command line', focus: 'pgrep -a includes each matching PID and its command line for review.',
      example: 'pgrep -a -x sleep', example_output: '123 sleep 30',
      task: 'Start sleep 30, print its PID and command line with pgrep, then stop it.',
      solution: 'sleep 30 & pid=$!; pgrep -a -x sleep; kill "$pid"', checks: [{ type: 'stdout-contains', description: 'The sleep duration appeared in the command line.', expected: 'sleep 30' }],
    },
    {
      title: 'Select the newest matching process', focus: 'pgrep -n returns only the newest process among all matches.',
      example: 'pgrep -n sleep', example_output: '456',
      task: 'Start two sleep processes, print only the newest sleep PID with pgrep -n, then stop both.',
      solution: 'sleep 30 & first=$!; sleep 30 & second=$!; pgrep -n -x sleep; kill "$first" "$second"', checks: [{ type: 'stdout-regex', description: 'One newest PID was printed.', expected: '[0-9]+' }],
    },
    {
      title: 'Match a full command line', focus: 'pgrep -f searches complete argument lists, allowing a distinctive workflow label to identify a process.',
      example: "bash -c 'exec -a worker sleep 30' & pgrep -af worker", example_output: '123 worker 30',
      task: 'Start sleep 30 with argv[0] gym-worker, locate it with pgrep -af gym-worker, then stop it.',
      solution: "bash -c 'exec -a gym-worker sleep 30' & pid=$!; pgrep -af gym-worker; kill \"$pid\"", checks: [{ type: 'stdout-contains', description: 'The labeled worker was found.', expected: 'gym-worker' }],
    },
  ],
  kill: [
    {
      title: 'List the available signals', focus: 'kill -l lists signal names and numbers without sending anything to a process.',
      example: 'kill -l | head -n 1', example_output: '1) SIGHUP 2) SIGINT ...',
      task: 'Print the signal list and prove it includes SIGTERM.',
      solution: 'kill -l', checks: [{ type: 'stdout-contains', description: 'SIGTERM was listed.', expected: 'SIGTERM' }],
    },
    {
      title: 'Probe whether a process exists', focus: 'Signal 0 performs permission and existence checks without delivering a real signal.',
      example: 'kill -0 "$pid" && echo alive', example_output: 'alive',
      task: 'Start sleep 30, use kill -0 to print alive, then terminate it.',
      solution: 'sleep 30 & pid=$!; kill -0 "$pid" && echo alive; kill "$pid"', checks: out('alive'),
    },
    {
      title: 'Send a named termination signal', focus: 'A named signal such as -TERM documents intent better than a raw number.',
      example: 'kill -TERM "$pid"', example_output: '',
      task: 'Start sleep 30, send it TERM with kill, wait for it, and print stopped.',
      solution: 'sleep 30 & pid=$!; kill -TERM "$pid"; wait "$pid" 2>/dev/null || true; echo stopped', checks: out('stopped'),
    },
    {
      title: 'Trigger a signal-aware cleanup', focus: 'Programs can trap a signal and perform cleanup before exiting; kill provides the explicit trigger.',
      example: "bash -c 'trap \"echo clean > done\" TERM; while :; do sleep 1; done' & kill -TERM $!", example_output: '',
      task: 'Start the provided signal-aware worker, send TERM, wait, and print the cleanup file.',
      solution: "bash worker.sh & pid=$!; sleep 0.1; kill -TERM \"$pid\"; wait \"$pid\" 2>/dev/null || true; cat cleanup.txt", files: { 'worker.sh': "#!/bin/bash\ntrap 'echo cleanup-complete > cleanup.txt; exit 0' TERM\nwhile :; do sleep 0.1; done\n" }, checks: out('cleanup-complete'),
    },
  ],
  nohup: [
    {
      title: 'Use the default output file', focus: 'When standard output is a terminal, nohup redirects it to nohup.out so it survives disconnection.',
      example: "nohup sh -c 'echo ready'", example_output: 'nohup: ignoring input and appending output to nohup.out',
      task: 'Run echo background-ready through nohup with output explicitly saved to nohup.out.',
      solution: "nohup sh -c 'echo background-ready' > nohup.out", checks: [{ type: 'file-content', description: 'The detached output was saved.', path: 'nohup.out', expected: 'background-ready\n' }],
    },
    {
      title: 'Separate standard output and errors', focus: 'Shell redirections around nohup can keep normal output and diagnostics in separate files.',
      example: "nohup sh -c 'echo ok; echo warn >&2' >out.log 2>err.log", example_output: '',
      task: 'Run job.sh with nohup, saving stdout to job.out and stderr to job.err.',
      solution: 'nohup bash job.sh > job.out 2> job.err', files: { 'job.sh': '#!/bin/bash\necho completed\necho diagnostic >&2\n' }, checks: [{ type: 'file-content', description: 'Normal output was saved.', path: 'job.out', expected: 'completed\n' }, { type: 'file-content', description: 'Diagnostic output was saved.', path: 'job.err', expected: 'diagnostic\n' }],
    },
    {
      title: 'Launch a detached background job', focus: 'Appending & returns control immediately while nohup gives the child hangup-resistant signal handling.',
      example: "nohup sh -c 'sleep 1; echo done' > result.txt &", example_output: '',
      task: 'Start job.sh under nohup in the background, wait for its PID, then print result.txt.',
      solution: 'nohup bash job.sh > result.txt 2>/dev/null & pid=$!; wait "$pid"; cat result.txt', files: { 'job.sh': '#!/bin/bash\nsleep 0.1\necho detached-complete\n' }, checks: out('detached-complete'),
    },
    {
      title: 'Record a detached job PID', focus: 'Saving $! after a nohup launch creates a PID file that later monitoring or cleanup can consume.',
      example: 'nohup sleep 30 >/dev/null 2>&1 & echo $! > job.pid', example_output: '',
      task: 'Launch sleep 30 with nohup, save its PID to worker.pid, verify it with kill -0, print running, then stop it.',
      solution: 'nohup sleep 30 >/dev/null 2>&1 & echo $! > worker.pid; pid=$(cat worker.pid); kill -0 "$pid" && echo running; kill "$pid"', checks: [...out('running'), { type: 'path-exists', description: 'The worker PID file was created.', path: 'worker.pid', kind: 'file' }],
    },
  ],
  nice: [
    {
      title: 'Run with a chosen niceness', focus: 'nice -n supplies an explicit niceness adjustment for the child command.',
      example: "nice -n 10 sh -c 'ps -o ni= -p $$'", example_output: '10',
      task: 'Run a shell at niceness 7 and print its NI value.',
      solution: "nice -n 7 sh -c 'ps -o ni= -p $$'", checks: out('7'),
    },
    {
      title: 'Use the default adjustment', focus: 'Without -n, nice applies its default adjustment of 10 to the child process.',
      example: "nice sh -c 'ps -o ni= -p $$'", example_output: '10',
      task: 'Run a shell with default nice behavior and print its NI value.',
      solution: "nice sh -c 'ps -o ni= -p $$'", checks: out('10'),
    },
    {
      title: 'Inspect a niced background process', focus: 'A longer-running nice child can be inspected with ps using its captured PID.',
      example: 'nice -n 12 sleep 30 & ps -o ni= -p $!', example_output: '12',
      task: 'Start sleep 30 at niceness 12, print its niceness with ps, then stop it.',
      solution: 'nice -n 12 sleep 30 & pid=$!; ps -o ni= -p "$pid"; kill "$pid"', checks: out('12'),
    },
    {
      title: 'Run a low-priority batch workflow', focus: 'nice can wrap an entire shell pipeline so CPU-intensive batch work starts with a lower scheduling priority.',
      example: "nice -n 15 sh -c 'sort big.txt > sorted.txt'", example_output: '',
      task: 'Run a shell at niceness 15 that sorts values.txt into sorted.txt and records its niceness in priority.txt.',
      solution: "nice -n 15 sh -c 'ps -o ni= -p $$ > priority.txt; sort -n values.txt > sorted.txt'", files: { 'values.txt': '9\n2\n7\n1\n' }, checks: [{ type: 'file-content', description: 'The batch output was sorted.', path: 'sorted.txt', expected: '1\n2\n7\n9\n' }, { type: 'file-content', description: 'The batch priority was recorded.', path: 'priority.txt', expected: '15', normalize: 'trim' }],
    },
  ],
  timeout: [
    {
      title: 'Allow a command that finishes in time', focus: 'timeout returns the child status normally when the deadline is not reached.',
      example: "timeout 2 sh -c 'echo ready'", example_output: 'ready',
      task: 'Give echo completed one second to finish.', solution: "timeout 1 sh -c 'echo completed'", checks: [...out('completed'), { type: 'exit-code', description: 'The command finished before its deadline.', expected: 0 }],
    },
    {
      title: 'Choose the expiration signal', focus: 'The -s option selects which signal timeout sends when the duration expires.',
      example: 'timeout -s INT 0.1 sleep 5', example_output: '',
      task: 'Limit sleep 5 to 0.1 seconds using the INT signal.',
      solution: 'timeout -s INT 0.1 sleep 5', checks: [{ type: 'exit-code', description: 'timeout reported deadline expiration.', expected: 124 }],
    },
    {
      title: 'Preserve a timed-out child status', focus: '--preserve-status returns the child signal-derived status instead of timeout\'s usual 124.',
      example: 'timeout --preserve-status 0.1 sleep 5', example_output: '',
      task: 'Run sleep 5 with a 0.1-second limit and preserve its TERM-derived status.',
      solution: 'timeout --preserve-status 0.1 sleep 5', checks: [{ type: 'exit-code', description: 'The terminated child status was preserved.', expected: 143 }],
    },
    {
      title: 'Handle a timeout in a workflow', focus: 'A shell conditional can translate timeout status 124 into a clear operational result.',
      example: 'timeout 1 slow-command || [ $? -eq 124 ] && echo timed-out', example_output: 'timed-out',
      task: 'Limit sleep 5 to 0.1 seconds and print deadline-exceeded only when timeout returns 124.',
      solution: 'timeout 0.1 sleep 5; status=$?; if [ "$status" -eq 124 ]; then echo deadline-exceeded; fi', checks: out('deadline-exceeded'),
    },
  ],
  sleep: [
    {
      title: 'Use a fractional duration', focus: 'GNU sleep accepts decimal seconds for short, controlled pauses.',
      example: 'sleep 0.25', example_output: '',
      task: 'Pause for 0.05 seconds.', solution: 'sleep 0.05', checks: [{ type: 'exit-code', description: 'The fractional pause completed.', expected: 0 }],
    },
    {
      title: 'Use an explicit unit suffix', focus: 'Suffixes such as s, m, h, and d document the intended time unit.',
      example: 'sleep 0.2s', example_output: '',
      task: 'Sleep for 0.05s using the seconds suffix.', solution: 'sleep 0.05s', checks: [{ type: 'exit-code', description: 'The suffixed pause completed.', expected: 0 }],
    },
    {
      title: 'Pause between retry attempts', focus: 'sleep inside a loop spaces repeated attempts without duplicating control logic.',
      example: "for n in 1 2; do echo attempt=$n; sleep 0.1; done", example_output: 'attempt=1\nattempt=2',
      task: 'Print attempt=1 through attempt=3 with a 0.02-second sleep after each.',
      solution: 'for n in 1 2 3; do echo attempt=$n; sleep 0.02; done', checks: out('attempt=1\nattempt=2\nattempt=3'),
    },
    {
      title: 'Coordinate a background result', focus: 'A background worker can sleep before producing a result while wait synchronizes the main workflow.',
      example: "(sleep 0.1; echo ready > status) & wait; cat status", example_output: 'ready',
      task: 'Start a background subshell that sleeps 0.05 seconds and writes complete to status.txt; wait and print it.',
      solution: '(sleep 0.05; echo complete > status.txt) & wait; cat status.txt', checks: out('complete'),
    },
  ],
  time: [
    {
      title: 'Use verbose resource statistics', focus: 'GNU time -v reports elapsed time, CPU, memory, and context-switch details to standard error.',
      example: '/usr/bin/time -v true', example_output: '... Maximum resident set size ...',
      task: 'Measure true with /usr/bin/time -v.',
      solution: '/usr/bin/time -v true', checks: [{ type: 'stderr-contains', description: 'Maximum resident memory was reported.', expected: 'Maximum resident set size' }],
    },
    {
      title: 'Choose a custom timing format', focus: 'GNU time -f emits only selected metrics using format placeholders.',
      example: "/usr/bin/time -f 'elapsed=%e' sleep 0.1", example_output: 'elapsed=0.10',
      task: 'Measure sleep 0.05 and print a custom elapsed=<seconds> line.',
      solution: "/usr/bin/time -f 'elapsed=%e' sleep 0.05", checks: [{ type: 'stderr-contains', description: 'The custom elapsed label was emitted.', expected: 'elapsed=' }],
    },
    {
      title: 'Write timing data to a file', focus: 'GNU time -o keeps metrics separate from both the child\'s normal output and its diagnostics.',
      example: "/usr/bin/time -o timing.txt -f '%e' command", example_output: '',
      task: 'Measure sort -n values.txt, save elapsed=<seconds> to timing.txt, and save sorted output to sorted.txt.',
      solution: "/usr/bin/time -o timing.txt -f 'elapsed=%e' sort -n values.txt > sorted.txt; cut -d= -f1 timing.txt", files: { 'values.txt': '8\n2\n5\n1\n' }, checks: [{ type: 'file-content', description: 'The command output was saved separately.', path: 'sorted.txt', expected: '1\n2\n5\n8\n' }, ...out('elapsed', 'The timing label was saved separately.')],
    },
    {
      title: 'Compare two implementations', focus: 'Separate time output files make it possible to compare alternative commands without mixing their result data.',
      example: "/usr/bin/time -o first.time command1; /usr/bin/time -o second.time command2", example_output: '',
      task: 'Time sort and sort -n separately into lexical.time and numeric.time, then print the two metric labels.',
      solution: "/usr/bin/time -o lexical.time -f 'lexical=%e' sort values.txt >/dev/null; /usr/bin/time -o numeric.time -f 'numeric=%e' sort -n values.txt >/dev/null; cut -d= -f1 lexical.time numeric.time", files: { 'values.txt': '10\n2\n30\n4\n' }, checks: out('lexical\nnumeric'),
    },
  ],
  seq: [
    {
      title: 'Use a custom increment', focus: 'A middle argument sets the step between the first and last values.',
      example: 'seq 2 2 10', example_output: '2\n4\n6\n8\n10',
      task: 'Print odd numbers from 1 through 11.', solution: 'seq 1 2 11', checks: out('1\n3\n5\n7\n9\n11'),
    },
    {
      title: 'Count downward', focus: 'A negative increment produces a descending sequence when the first value is greater than the last.',
      example: 'seq 5 -1 1', example_output: '5\n4\n3\n2\n1',
      task: 'Print a countdown from 10 to 0 in steps of 2.', solution: 'seq 10 -2 0', checks: out('10\n8\n6\n4\n2\n0'),
    },
    {
      title: 'Format each generated value', focus: 'seq -f applies a printf-style floating-point format to every value.',
      example: "seq -f 'item-%02g' 1 3", example_output: 'item-01\nitem-02\nitem-03',
      task: 'Print batch-001 through batch-005.', solution: "seq -f 'batch-%03g' 1 5", checks: out('batch-001\nbatch-002\nbatch-003\nbatch-004\nbatch-005'),
    },
    {
      title: 'Drive a repeatable batch loop', focus: 'Command substitution turns a seq into controlled loop inputs for creating or processing numbered artifacts.',
      example: 'for n in $(seq -w 1 3); do touch part-$n; done', example_output: '',
      task: 'Use seq -w to create chunk-01.txt through chunk-05.txt, each containing its two-digit number, then print their names.',
      solution: 'for n in $(seq -w 01 05); do echo "$n" > "chunk-$n.txt"; done; printf "%s\n" chunk-*.txt', checks: out('chunk-01.txt\nchunk-02.txt\nchunk-03.txt\nchunk-04.txt\nchunk-05.txt'),
    },
  ],
};
