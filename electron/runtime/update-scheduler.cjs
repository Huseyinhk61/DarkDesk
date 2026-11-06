// Checks only: downloads and restarts still require an explicit user action.
class UpdateScheduler {
  constructor(
    updates,
    {
      clock = Date.now,
      setTimer = setTimeout,
      clearTimer = clearTimeout,
      initialDelay = 30000,
      interval = 6 * 60 * 60 * 1000,
      retryDelay = 15 * 60 * 1000,
      wakeDelay = 30 * 60 * 1000,
    } = {},
  ) {
    Object.assign(this, {
      updates,
      clock,
      setTimer,
      clearTimer,
      initialDelay,
      interval,
      retryDelay,
      wakeDelay,
    });
    this.timer = null;
    this.timerDue = Infinity;
    this.lastAttempt = -Infinity;
    this.pending = null;
    this.disposed = false;
  }
  schedule(delay) {
    if (this.disposed) return;
    const due = this.clock() + Math.max(0, delay);
    if (this.timer !== null && this.timerDue <= due) return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timerDue = due;
    this.timer = this.setTimer(
      () => {
        this.timer = null;
        this.timerDue = Infinity;
        this.run('timer');
      },
      Math.max(0, delay),
    );
    this.timer?.unref?.();
  }
  start() {
    this.schedule(this.initialDelay);
  }
  wake() {
    return this.run('wake');
  }
  run(reason) {
    if (this.disposed) return Promise.resolve(false);
    if (this.pending) return this.pending;
    const status = this.updates.status();
    if (status.state === 'unsupported') return Promise.resolve(false);
    if (status.installing || ['checking', 'downloading', 'downloaded'].includes(status.state)) {
      this.schedule(this.retryDelay);
      return Promise.resolve(false);
    }
    const checked = Date.parse(status.lastChecked),
      last = Math.max(this.lastAttempt, Number.isFinite(checked) ? checked : -Infinity),
      gap =
        status.state === 'error'
          ? this.retryDelay
          : reason === 'wake'
            ? this.wakeDelay
            : this.interval,
      remaining = gap - (this.clock() - last);
    if (remaining > 0) {
      this.schedule(remaining);
      return Promise.resolve(false);
    }
    this.lastAttempt = this.clock();
    const operation = Promise.resolve()
      .then(() => (this.disposed ? false : this.updates.check()))
      .catch(() => false)
      .finally(() => {
        this.pending = null;
        this.schedule(this.updates.status().state === 'error' ? this.retryDelay : this.interval);
      });
    this.pending = operation;
    return operation;
  }
  dispose() {
    this.disposed = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }
}
module.exports = { UpdateScheduler };
