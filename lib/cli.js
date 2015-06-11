#!/usr/bin/env node;
var cli, colors, cpuThreshold, d, error, fs, javahighcpu, meow, obj, offenders, parseThreadDumps, parseTop, parsedThreadDumps, parsedTop, pid, proc, processes, ref, ref1, thread, timestamp,
  hasProp = {}.hasOwnProperty;

fs = require('fs');

colors = require('colors');

meow = require('meow');

javahighcpu = require('./javahighcpu');

parseTop = require('./parseTop');

parseThreadDumps = require('./parseThreadDumps');

cli = meow({
  pkg: require("../package.json"),
  help: "Correlates top output with thread dumps.\nThis tool was inspired from https://access.redhat.com/solutions/24830 (Java application high CPU) and https://access.redhat.com/solutions/46596 (How do I identify high CPU utilization by Java threads on Linux/Solaris)\n\nThe top output comes from: top -b -n 1 -H -p <pid> >> high-cpu.out\n\nThe thread dump output comes from jstack -1 <pid> >> high-cpu-tdumps.out\n\nSee the following for generating these files automatically:\n  bin/high_cpu_linux_jstack.sh\n  bin/high_cpu_linux.sh\n\n\nUsage:\n  javahighcpu [-h] [-t 80] [high-cpu.out] [high-cpu.tdump.out]\n\nOptions:\n  h         Show this help\n  t         CPU Threshold, default: 80 as in 80%\n\nExample\n  javahighcpu -t 80 high-cpu.out high-cpu.tdump.out"
});

if (cli.flags.h) {
  console.log(cli.help);
  return;
}

try {
  if ((ref = fs.lstatSync(cli.input[0])) != null) {
    ref.isFile();
  }
} catch (_error) {
  console.error(("Not a valid path/file for the high cpu output: " + cli.input[0]).red);
  console.log(cli.help);
  return;
}

try {
  if ((ref1 = fs.lstatSync(cli.input[1])) != null) {
    ref1.isFile();
  }
} catch (_error) {
  console.error(("Not a valid path/file for the thread dumps: " + cli.input[0]).red);
  console.log(cli.help);
  return;
}

cpuThreshold = cli.flags.t || 80;

parsedTop = {};

try {
  parsedTop = parseTop(fs.readFileSync(cli.input[0]).toString(), {
    cpuThreshold: cpuThreshold
  });
} catch (_error) {
  error = _error;
  console.error(error.message.red);
  console.error("Could not parse high cpu top output, please use a file with valid input".red);
  return;
}

parsedThreadDumps = {};

try {
  parsedThreadDumps = parseThreadDumps(fs.readFileSync(cli.input[1]).toString());
} catch (_error) {
  console.error(error.message.red);
  console.error("Could not parse thread dumps, please use a file with valid input".red);
  return;
}

console.log(("Read " + (Object.keys(parsedTop).length) + " top outputs and " + (Object.keys(parsedThreadDumps).length) + " thread dumps.").cyan);

offenders = javahighcpu(parsedTop, parsedThreadDumps);

if (offenders && Object.keys(offenders).length > 0) {
  for (timestamp in offenders) {
    if (!hasProp.call(offenders, timestamp)) continue;
    processes = offenders[timestamp];
    d = new Date(+timestamp);
    console.log(("Found offending processes @ " + (d.toLocaleString())).blue);
    for (pid in processes) {
      if (!hasProp.call(processes, pid)) continue;
      obj = processes[pid];
      proc = obj['process'];
      thread = obj['thread'];
      console.log(("\tpid: " + (colors.bold(proc.pid)) + "\thex: " + (colors.bold(proc.hexpid)) + "\tcpu: " + (colors.bold(proc.cpu)) + "%\tmem: " + (colors.bold(proc.mem)) + "%").yellow);
      if (thread != null) {
        thread.forEach(function(stackLine, i) {
          return console.log(((i === 0 ? "" : "\t") + "\t\t" + stackLine).cyan);
        });
      }
    }
  }
} else {
  console.log(("No high cpu threads within the threshold (" + cpuThreshold + "%) specified.").yellow);
}