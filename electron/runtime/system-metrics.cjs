const os = require('node:os');
const fs = require('node:fs/promises');
class SystemMetrics {
  constructor({
    cpus = () => os.cpus(),
    total = () => os.totalmem(),
    free = () => os.freemem(),
    rss = () => process.memoryUsage().rss,
    clock = () => Date.now(),
    platform = process.platform,
    uptime = () => os.uptime(),
    diskPath = os.homedir(),
    statfs = fs.statfs,
    listVolumes = null,
  } = {}) {
    Object.assign(this, {
      readCpus: cpus,
      readTotal: total,
      readFree: free,
      readRss: rss,
      clock,
      platform,
      uptime,
      diskPath,
      statfs,
      listVolumes,
    });
    this.diskCache = null;
    this.disks = [];
    this.diskRead = null;
    this.diskAt = -Infinity;
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
      cpuModel: cpus[0]?.model || null,
      speedMHz: cpus.length
        ? Math.round(cpus.reduce((total, cpu) => total + (cpu.speed || 0), 0) / cpus.length)
        : null,
      uptimeSeconds: this.uptime(),
      cores: this.cores,
      sampledAt: this.sampledAt,
      memory: { total, free, used, percent: total > 0 ? (used * 100) / total : 0 },
      process: { rss: this.readRss() },
    };
  }
  async detailedSnapshot() {
    if (this.clock() - this.diskAt >= 15000 || this.clock() < this.diskAt) {
      if (!this.diskRead)
        this.diskRead = Promise.resolve()
          .then(async () => {
            const volumes = this.listVolumes
              ? await this.listVolumes().catch(() => [
                  { path: this.diskPath, label: this.diskPath },
                ])
              : [{ path: this.diskPath, label: this.diskPath }];
            this.disks = await Promise.all(
              volumes.slice(0, 64).map(async (volume) => {
                try {
                  let total = volume.total,
                    free = volume.free;
                  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free)) {
                    const value = await this.statfs(volume.path);
                    total = value.blocks * value.bsize;
                    free = value.bavail * value.bsize;
                  }
                  if (
                    !Number.isFinite(total) ||
                    !Number.isFinite(free) ||
                    total <= 0 ||
                    free < 0 ||
                    free > total
                  )
                    throw Error('DISK_UNAVAILABLE');
                  return { ...volume, total, free, percent: (100 * (total - free)) / total };
                } catch {
                  return { path: volume.path, label: volume.label, unavailable: true };
                }
              }),
            );
            const selected =
              this.disks.find(
                (v) =>
                  this.diskPath.toLowerCase().startsWith(v.path.toLowerCase()) && !v.unavailable,
              ) || this.disks.find((v) => !v.unavailable);
            this.diskCache = selected
              ? { total: selected.total, free: selected.free, percent: selected.percent }
              : null;
          })
          .catch(() => {
            this.diskCache = null;
            this.disks = [];
          })
          .finally(() => {
            this.diskAt = this.clock();
            this.diskRead = null;
          });
      await this.diskRead;
    }
    return { ...this.snapshot(), disk: this.diskCache, disks: this.disks };
  }
}
module.exports = { SystemMetrics };
