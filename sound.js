function getSoundData(filename) {
    return new Promise(function(resolve, reject) {
        let request = new XMLHttpRequest();
        request.open(
            'GET', 'http://' + window.location.hostname + ":80/" + filename);
        request.responseType = 'arraybuffer';
        request.onload = function() {
            resolve(request.response);
        }
        request.onerror = function() {
            reject(request.statusText);
        }
        request.send();
    });
}

const BASE_FREQS = [
    55.0000, // A
    58.2705, // A#
    61.7354, // B
    65.4064, // C
    69.2957, // C#
    73.4162, // D
    77.7817, // D#
    82.4069, // E
    87.3071, // F
    92.4986, // F#
    97.9989, // G
    103.826, // G#
];

const NOTES = {
    A: 0,
    A_S: 1,
    B_F: 1,
    B: 2,
    C: 3,
    C_S: 4,
    D_F: 4,
    D: 5,
    D_S: 6,
    E_F: 6,
    E: 7,
    F: 8,
    F_S: 9,
    G_F: 9,
    G: 10,
    G_S: 11,
    A_F: 11
};

function getFreq(note, octave) {
    return BASE_FREQS[note] * (1 << octave);
}

function initSynth(audioCtx, synthSpec) {
    // TODO: consider making this more efficient if no modulation gain/freq are 0.
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(synthSpec.filterCutoff, audioCtx.currentTime);
    filterNode.Q.value = 0.0;
    filterModFreq = audioCtx.createOscillator();
    filterModFreq.frequency.setValueAtTime(synthSpec.filterModFreq, audioCtx.currentTime);
    filterModGain = audioCtx.createGain();
    filterModGain.gain.setValueAtTime(synthSpec.filterModGain, audioCtx.currentTime);
    filterModFreq.connect(filterModGain).connect(filterNode.frequency);
    filterModFreq.start();

    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(synthSpec.gain, audioCtx.currentTime);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    let voices = [];
    for (let i = 0; i < synthSpec.voiceSpecs.length; ++i) {
        // TODO: consider making this more efficient if osc2Gain == 0 by only initializing one oscillator.
        let osc2Detune = synthSpec.voiceSpecs[i].osc2Detune;
        let osc2GainValue = synthSpec.voiceSpecs[i].osc2Gain;

        let defaultFreq = getFreq(NOTES.A, 3);

        let osc1 = audioCtx.createOscillator();
        osc1.type = synthSpec.voiceSpecs[i].osc1Type;
        osc1.frequency.setValueAtTime(defaultFreq, audioCtx.currentTime);

        let osc2 = audioCtx.createOscillator();
        osc2.type = synthSpec.voiceSpecs[i].osc2Type;
        osc2.detune.setValueAtTime(osc2Detune, audioCtx.currentTime);
        osc2.frequency.setValueAtTime(defaultFreq, audioCtx.currentTime);

        let voiceGainNode = audioCtx.createGain();
        voiceGainNode.gain.setValueAtTime(0.0, audioCtx.currentTime);
        voiceGainNode.connect(filterNode);
        osc1.connect(voiceGainNode);
        let osc2GainNode = audioCtx.createGain();
        osc2GainNode.gain.setValueAtTime(osc2GainValue, audioCtx.currentTime);
        osc2GainNode.connect(voiceGainNode);
        osc2.connect(osc2GainNode);

        osc1.start();
        osc2.start();

        voices.push({
            osc1: osc1,
            osc2: osc2,
            gain: voiceGainNode,
            osc2Gain: osc2GainNode,
        });
    }

    return {
        voices: voices,
        filter: filterNode,
        filterModFreq: filterModFreq,
        filterModGain: filterModGain,
        gain: gainNode,
        attackTime: synthSpec.attackTime,
        releaseTime: synthSpec.releaseTime
    };
}

function initSound() {
    let soundNames = ['kick', 'hihat', 'cowbell', 'drone'];
    let sounds = soundNames.map(function(soundName) {
        return getSoundData(soundName + '.wav')
    });
    let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return Promise.all(sounds).then(function(loadedSounds) {
        return Promise.all(loadedSounds.map(function(loadedSound) {
            return audioCtx.decodeAudioData(loadedSound);
        }));
    }).then(function(decodedSounds) {
        let voiceSpec = {
            osc1Type: 'sawtooth',
            osc2Type: 'sawtooth',
            osc2Gain: 0.7,
            osc2Detune: 30 // cents
        };
        let synthSpecs = [
            {
                gain: 1.0,
                filterCutoff: 9999,
                filterModFreq: 0,
                filterModGain: 0,
                voiceSpecs: [voiceSpec],
                attackTime: 0.01,
                releaseTime: 0.1
            },
            {
                gain: 1.0,
                filterCutoff: 999,
                filterModFreq: 0,
                filterModGain: 0,
                voiceSpecs: [voiceSpec],
                attackTime: 0.01,
                releaseTime: 0.1
            },
            {
                // Pad
                gain: 0.25,
                filterCutoff: 600,
                filterModFreq: 5,
                filterModGain: 250,
                attackTime: 0.01,
                releaseTime: 0.1,
                voiceSpecs: [
                    {
                        osc1Type: 'sawtooth',
                        osc2Type: 'sawtooth',
                        osc2Gain: 0.7,
                        osc2Detune: 30
                    }
                ]
            },
            {
                // Bass
                gain: 1.0,
                filterCutoff: 300,
                filterModFreq: 0,
                filterModGain: 0,
                attackTime: 0.01,
                releaseTime: 0.5,
                voiceSpecs: [
                    { osc1Type: 'square',
                      osc2Type: 'sine',
                      osc2Gain: 0.0,
                      osc2Detune: 0.0 }
                ]
            }
        ];
        let synths = [];
        let auxSynths = [];
        for (let i = 0; i < synthSpecs.length; ++i) {
            synths.push(initSynth(audioCtx, synthSpecs[i]));
            auxSynths.push(initSynth(audioCtx, synthSpecs[i]));
        }

        // drone sound
        let droneSource = audioCtx.createBufferSource();
        droneSource.buffer = decodedSounds[3];
        droneSource.loop = true;
        droneSource.loopStart = 1.0;
        // SUPER weird: for some reason we *need* to set loopEnd for the sample to loop correctly
        // (even though the sample length is exactly this length).
        droneSource.loopEnd = 4.0
        let droneFilter = audioCtx.createBiquadFilter();
        droneFilter.type = 'lowpass';
        // droneFilter.frequency.setValueAtTime(100, audioCtx.currentTime);
        droneFilter.frequency.value = 100.0;
        let droneGain = audioCtx.createGain();
        droneGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        droneSource.connect(droneFilter);
        droneFilter.connect(droneGain);
        droneGain.connect(audioCtx.destination);
        droneSource.start(0);
        
        return {
            audioCtx: audioCtx,
            drumSounds: decodedSounds,
            droneNode: droneSource,
            droneFilter: droneFilter,
            droneGain: droneGain,
            synths: synths,
            auxSynths: auxSynths
        }
    });
}

function synthPlayVoice(synth, voiceIdx, freq, sustain, audioCtx) {
    let voice = synth.voices[voiceIdx];
    voice.osc1.frequency.setValueAtTime(freq, audioCtx.currentTime);
    voice.osc2.frequency.setValueAtTime(freq, audioCtx.currentTime);
    voice.gain.gain.cancelScheduledValues(audioCtx.currentTime);
    voice.gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    voice.gain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + synth.attackTime);
    if (!sustain) {
        voice.gain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + synth.releaseTime);
    }
}

function synthReleaseVoice(synth, voiceIdx, audioCtx) {
    let voice = synth.voices[voiceIdx];
    voice.gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
}

function playSoundFromBuffer(audioCtx, buffer) {
    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
}