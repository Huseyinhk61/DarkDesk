let context;
export async function armFocusAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw Error('AUDIO_UNAVAILABLE');
  if (!context || context.state === 'closed') context = new Audio();
  if (context.state === 'suspended') await context.resume();
  if (context.state !== 'running') throw Error('AUDIO_UNAVAILABLE');
  return context;
}
export async function playFocusBell(volume = 65) {
  if (volume === 0) return;
  const audio = await armFocusAudio();
  for (let i = 0; i < 3; i++) {
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    const start = audio.currentTime + i * 0.42;
    oscillator.type = 'sine';
    oscillator.frequency.value = i === 1 ? 880 : 660;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      (Math.max(0, Math.min(100, volume)) / 100) * 0.22,
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.4);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
