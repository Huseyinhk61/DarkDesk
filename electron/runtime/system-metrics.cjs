const os = require('node:os');
class SystemMetrics {
  constructor({
    cpus = () => os.cpus(),
    total = () => os.totalmem(),
    free = () => os.freemem(),
    rss = () => process.memoryUsage().rss,
    clock = () => Date.now(),
    platform = process.platform,
  } = {}) {
    Object.assign(this, {
      readCpus: cpus,
      readTotal: total,
      readFree: free,
      readRss: rss,
      clock,
      platform,
    });
    this.last = null;
    this.percent = null;
    this.cores = [];
    this.sampledAt = null;
  }
  snapshot() {
    const now = this.clock();
    const cpus = this.readCpus();
    const coreTimes = cpus.map((cpu) => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((a, b) => a + b, 0),
    }));
    const sums = cpus.reduce(
      (result, cpu) => ({
        idle: result.idle + cpu.times.idle,
        total: result.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
      }),
      { idle: 0, total: 0 },
    );
    if (!this.last || now - this.last.at >= 1000 || now < this.last.at) {
      if (this.last && now >= this.last.at) {
        const delta = sums.total - this.last.total;
        this.percent =
          delta > 0
            ? Math.max(0, Math.min(100, 100 * (1 - (sums.idle - this.last.idle) / delta)))
            : null;
      } else this.percent = null;
      this.cores = coreTimes.map((core, index) => {
        const previous = this.last?.cores?.[index];
        if (!previous || now < this.last.at || core.total <= previous.total) return null;
        return Math.max(
          0,
          Math.min(100, 100 * (1 - (core.idle - previous.idle) / (core.total - previous.total))),
        );
      });
      this.last = { ...sums, cores: coreTimes, at: now };
      this.sampledAt = now;
    }
    const total = this.readTotal();
    const free = Math.max(0, Math.min(total, this.readFree()));
    const used = total - free;
    return {
      platform: this.platform,
      cpuPercent: this.percent,
      coreCount: cpus.length,
      cores: this.cores,
      sampledAt: this.sampledAt,
      memory: { total, free, used, percent: total > 0 ? (used * 100) / total : 0 },
      process: { rss: this.readRss() },
    };
  }
}
module.exports = { SystemMetrics };
