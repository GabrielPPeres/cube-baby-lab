# Static function and subsystem map

This map is intentionally conservative. It combines PE imports, embedded Qt meta-object/RTTI
names and diagnostic strings. It does not claim source-level function recovery because the local
REA installation has no configured Ghidra, IDA or Kuna provider.

| Area | Observed anchor | Static evidence | Interpretation | Confidence |
| --- | --- | --- | --- | --- |
| MIDI input | `RtMidiIn`, `MidiInWinMM` | RtMidi diagnostic strings; `midiInGetNumDevs`, `midiInGetDevCapsW`, `midiInOpen`, `midiInPrepareHeader`, `midiInAddBuffer`, `midiInStart`, reset/stop/close imports | Windows Multimedia MIDI input backend is compiled into the executable | observed |
| MIDI output | `RtMidiOut`, `MidiOutWinMM` | RtMidi strings; `midiOutOpen`, caps/count, short/long message, prepare/unprepare header and close imports | Windows Multimedia MIDI output backend is compiled into the executable | observed |
| SysEx transmit | `MidiOutWinMM::sendMessage` | Strings for preparing/sending a SysEx header plus `midiOutLongMsg` | Long MIDI messages are sent through WinMM; this is compatible with the captured CubeSuite SysEx | observed/derived |
| Application port wrapper | `CUSBPort` | MSVC RTTI class name at file offset `0x3587b4` | Likely the application's MIDI/USB abstraction; exact methods and callers were not recovered | inferred |
| Cube Baby editors | `CCubeBabyIREditDlg`, `CCubeBabyCAIREditDlg`, `CCubeBabyJunIREditDlg` | MSVC RTTI names and Qt slot string `OnUSBLoopBack(bool)` | Several Cube Baby-family dialogs share a USB-loopback UI/action | observed; semantics unknown |
| Preset I/O UI | `OnSaveEffect`, import/export current/all preset | Qt meta-object/UI strings plus read/write/verify/timeout messages | The application has preset file/device flows and explicit verification/error paths | observed; protocol linkage inferred |
| Networking | `QNetworkAccessManager` | Qt5Network imports for GET/reply handling | HTTP/network functionality exists, but no evidence ties it to device control | observed; purpose unknown |
| Bluetooth control | none | No Qt5Bluetooth DLL/imports; no Bluetooth APIs, GATT/SDP/RFCOMM strings or UUIDs | CubeSuite supplies no static evidence of a Bluetooth control backend | observed absence within scanned PE/import/string surfaces |

## WinMM API boundary

The `WINMM.dll` import table contains exactly these 18 names:

```text
midiOutClose midiOutShortMsg midiOutLongMsg
midiInGetNumDevs midiInGetDevCapsW midiInOpen midiInClose
midiInPrepareHeader midiInUnprepareHeader midiInAddBuffer
midiInStart midiInStop midiInReset
midiOutOpen midiOutGetDevCapsW midiOutPrepareHeader
midiOutUnprepareHeader midiOutGetNumDevs
```

There are no imports from SetupAPI, HID, Windows Bluetooth, Winsock or serial-port Qt modules.
`GetProcAddress` is imported, so an import-table absence is strong negative evidence, not a formal
proof that a library can never be loaded dynamically.

## REA coverage

- Official ZIP inventory: complete central-directory view, 73 nodes/74 occurrences, no integrity
  contradictions. Evidence: `ev_a83e921d67046ddc481d8a83a2812c57ab4031bd64b53b0e92cc305feeaf0c4f`.
- PE resource tree: complete, three resources. Evidence:
  `ev_3b55020dd3a93ccb593502fe2802df2242b8024a92cc8bba542d35999f61c33e`.
- Deep function provider: unavailable locally. REA reported Ghidra not configured, Hopper unsupported
  on Windows, IDA not configured and Kuna not configured/PE unsupported.
- GNU objdump adapter: unavailable on this Windows host (`ERR_REA_WINDOWS_NATIVE`).

Therefore, names above are anchors, not recovered call graphs. A later run with Ghidra should use
the WinMM import thunks, `CUSBPort` RTTI and the Cube Baby dialog RTTI as initial xref targets.
