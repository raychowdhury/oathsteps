@preconcurrency import AVFoundation
import Foundation
@preconcurrency import Speech

/// Reads text aloud with the device's English voices. Works offline.
final class Speaker {
    private let synth = AVSpeechSynthesizer()

    func speak(_ text: String, rate: Double) {
        synth.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: "en-US")
        u.rate = Float(min(max(Double(AVSpeechUtteranceDefaultSpeechRate) * rate, Double(AVSpeechUtteranceMinimumSpeechRate)), Double(AVSpeechUtteranceMaximumSpeechRate)))
        synth.speak(u)
    }

    func stop() { synth.stopSpeaking(at: .immediate) }
}

enum ListenOutcome: Equatable {
    case heard(String)
    case noSpeech
    case denied
    /// This device cannot recognize speech on the device; OathSteps never sends audio to a server.
    case unsupported
    case failed(String)
}

/// One-shot on-device speech recognition for answering a question aloud. Experimental: the typed
/// and self-check paths are the dependable ones.
nonisolated final class Listener: @unchecked Sendable {
    private let lock = NSLock()
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var transcript = ""
    private var continuation: CheckedContinuation<ListenOutcome, Never>?

    static var onDeviceAvailable: Bool {
        guard let r = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) else { return false }
        return r.supportsOnDeviceRecognition
    }

    func listen(maxSeconds: Double = 8) async -> ListenOutcome {
        let auth = await withCheckedContinuation { (c: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0) }
        }
        guard auth == .authorized else { return .denied }
        guard await AVAudioApplication.requestRecordPermission() else { return .denied }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")), recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else { return .unsupported }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.requiresOnDeviceRecognition = true
        req.shouldReportPartialResults = true
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let input = engine.inputNode
            input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in req.append(buffer) }
            engine.prepare()
            try engine.start()
        } catch {
            cleanUp()
            return .failed(error.localizedDescription)
        }

        return await withCheckedContinuation { c in
            lock.withLock {
                continuation = c
                request = req
                transcript = ""
            }
            let t = recognizer.recognitionTask(with: req) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    self.lock.withLock { self.transcript = result.bestTranscription.formattedString }
                    if result.isFinal { self.finish() }
                } else if error != nil {
                    self.finish()
                }
            }
            lock.withLock { task = t }
            DispatchQueue.main.asyncAfter(deadline: .now() + maxSeconds) { [weak self] in self?.stop() }
        }
    }

    /// Stop listening; the recognizer then delivers its final result.
    func stop() {
        lock.withLock { request?.endAudio() }
        if engine.isRunning {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.finish() }
    }

    private func finish() {
        let (c, text): (CheckedContinuation<ListenOutcome, Never>?, String) = lock.withLock {
            let c = continuation
            continuation = nil
            return (c, transcript)
        }
        guard let c else { return }
        cleanUp()
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        c.resume(returning: trimmed.isEmpty ? .noSpeech : .heard(trimmed))
    }

    private func cleanUp() {
        if engine.isRunning {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        lock.withLock {
            task?.cancel()
            task = nil
            request = nil
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
