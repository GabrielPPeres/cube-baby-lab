import { BACKUP_SCHEMA, CAPTURED_BANK_HEX, PARAMS, SLOT_IDS, editByte, exportBackup, fromHex, importBackup, readSlot, toHex } from "./model.js";

let bank = fromHex(CAPTURED_BANK_HEX);
let activeSlot = 0;
let sequence = 1;

const slotTabs = document.querySelector("#slotTabs");
const parameterGrid = document.querySelector("#parameterGrid");
const hexRows = document.querySelector("#hexRows");
const operationLog = document.querySelector("#operationLog");

function log(level, event, message) {
  const row = document.createElement("div");
  row.className = `log-row ${level}`;
  row.innerHTML = `<span>${String(sequence).padStart(3, "0")}</span><time>${new Date().toLocaleTimeString("pt-BR")}</time><strong>${event}</strong><p>${message}</p>`;
  sequence += 1;
  operationLog.prepend(row);
}

function renderSlots() {
  slotTabs.replaceChildren(...SLOT_IDS.map((slot, index) => {
    const button = document.createElement("button");
    button.textContent = slot;
    button.role = "tab";
    button.ariaSelected = String(index === activeSlot);
    button.className = index === activeSlot ? "active" : "";
    button.addEventListener("click", () => {
      activeSlot = index;
      log("info", "slot.select", `Slot simulado ${slot} selecionado.`);
      render();
    });
    return button;
  }));
}

function renderParameters() {
  const slot = readSlot(bank, activeSlot);
  parameterGrid.replaceChildren(...PARAMS.map(([name, label, max], index) => {
    const card = document.createElement("label");
    card.className = "parameter-card";
    card.innerHTML = `<span>${label}</span><small>offset +0x${index.toString(16).padStart(2, "0")} · máx ${max}</small>`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(max);
    input.value = String(slot.values[name]);
    input.addEventListener("change", () => {
      try {
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`Valor fora do limite 0–${max}.`);
        const beforeTrailing = readSlot(bank, activeSlot).trailing.join(",");
        bank = editByte(bank, activeSlot, index, value);
        if (readSlot(bank, activeSlot).trailing.join(",") !== beforeTrailing) throw new Error("Bytes trailing foram alterados.");
        log("info", "preset.edit", `${SLOT_IDS[activeSlot]}.${name} = ${value}; banco simulado verificado.`);
        renderHex();
      } catch (error) {
        input.value = String(readSlot(bank, activeSlot).values[name]);
        log("error", "preset.error", error instanceof Error ? error.message : String(error));
      }
    });
    card.append(input);
    return card;
  }));
}

function renderHex() {
  hexRows.replaceChildren(...SLOT_IDS.map((slot, index) => {
    const start = index * 16;
    const bytes = [...bank.slice(start, start + 16)];
    const row = document.createElement("div");
    row.className = "hex-row";
    row.innerHTML = `<strong>${slot}</strong><span>0x${start.toString(16).padStart(2, "0")}</span><code>${bytes.map((byte, offset) => `<b class="${offset >= 13 ? "trailing" : ""}">${byte.toString(16).padStart(2, "0")}</b>`).join(" ")}</code>`;
    return row;
  }));
}

function render() {
  renderSlots();
  renderParameters();
  renderHex();
}

document.querySelector("#exportButton").addEventListener("click", () => {
  const text = exportBackup(bank);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  link.download = `cube-baby-bank-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  log("info", "backup.export", `Backup ${BACKUP_SCHEMA} exportado (${toHex(bank).length / 2} bytes).`);
});

document.querySelector("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    bank = importBackup(await file.text());
    log("info", "backup.import", `Backup ${file.name} importado e validado offline.`);
    render();
  } catch (error) {
    log("error", "backup.error", error instanceof Error ? error.message : String(error));
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#mockDiscoveryButton").addEventListener("click", () => {
  document.querySelector("#classicResult").textContent = "0 dispositivos · 0 registros SDP";
  document.querySelector("#bleResult").textContent = "0 dispositivos · 0 serviços GATT";
  log("warn", "bluetooth.mock", "Descoberta mock concluída sem hardware. Transporte continua desconectado; nenhum UUID foi criado.");
});

document.querySelector("#clearLogButton").addEventListener("click", () => operationLog.replaceChildren());

render();
log("info", "lab.ready", "Banco capturado carregado no simulador. Nenhum transporte físico ativo.");
