export interface Opcode {
  pc: number;
  code: number;
  name: string;
  pushData?: string;
}

const opcodeNames = new Map<number, string>([
  [0x00, "STOP"],
  [0x01, "ADD"],
  [0x02, "MUL"],
  [0x03, "SUB"],
  [0x04, "DIV"],
  [0x05, "SDIV"],
  [0x06, "MOD"],
  [0x07, "SMOD"],
  [0x08, "ADDMOD"],
  [0x09, "MULMOD"],
  [0x0a, "EXP"],
  [0x0b, "SIGNEXTEND"],
  [0x10, "LT"],
  [0x11, "GT"],
  [0x12, "SLT"],
  [0x13, "SGT"],
  [0x14, "EQ"],
  [0x15, "ISZERO"],
  [0x16, "AND"],
  [0x17, "OR"],
  [0x18, "XOR"],
  [0x19, "NOT"],
  [0x1a, "BYTE"],
  [0x1b, "SHL"],
  [0x1c, "SHR"],
  [0x1d, "SAR"],
  [0x20, "SHA3"],
  [0x30, "ADDRESS"],
  [0x31, "BALANCE"],
  [0x32, "ORIGIN"],
  [0x33, "CALLER"],
  [0x34, "CALLVALUE"],
  [0x35, "CALLDATALOAD"],
  [0x36, "CALLDATASIZE"],
  [0x37, "CALLDATACOPY"],
  [0x38, "CODESIZE"],
  [0x39, "CODECOPY"],
  [0x3a, "GASPRICE"],
  [0x3b, "EXTCODESIZE"],
  [0x3c, "EXTCODECOPY"],
  [0x3d, "RETURNDATASIZE"],
  [0x3e, "RETURNDATACOPY"],
  [0x3f, "EXTCODEHASH"],
  [0x40, "BLOCKHASH"],
  [0x41, "COINBASE"],
  [0x42, "TIMESTAMP"],
  [0x43, "NUMBER"],
  [0x44, "PREVRANDAO"],
  [0x45, "GASLIMIT"],
  [0x46, "CHAINID"],
  [0x47, "SELFBALANCE"],
  [0x48, "BASEFEE"],
  [0x49, "BLOBHASH"],
  [0x4a, "BLOBBASEFEE"],
  [0x50, "POP"],
  [0x51, "MLOAD"],
  [0x52, "MSTORE"],
  [0x53, "MSTORE8"],
  [0x54, "SLOAD"],
  [0x55, "SSTORE"],
  [0x56, "JUMP"],
  [0x57, "JUMPI"],
  [0x58, "PC"],
  [0x59, "MSIZE"],
  [0x5a, "GAS"],
  [0x5b, "JUMPDEST"],
  [0x5f, "PUSH0"],
  [0xf0, "CREATE"],
  [0xf1, "CALL"],
  [0xf2, "CALLCODE"],
  [0xf3, "RETURN"],
  [0xf4, "DELEGATECALL"],
  [0xf5, "CREATE2"],
  [0xfa, "STATICCALL"],
  [0xfd, "REVERT"],
  [0xfe, "INVALID"],
  [0xff, "SELFDESTRUCT"]
]);

for (let opcode = 0x60; opcode <= 0x7f; opcode += 1) {
  opcodeNames.set(opcode, `PUSH${opcode - 0x5f}`);
}

for (let opcode = 0x80; opcode <= 0x8f; opcode += 1) {
  opcodeNames.set(opcode, `DUP${opcode - 0x7f}`);
}

for (let opcode = 0x90; opcode <= 0x9f; opcode += 1) {
  opcodeNames.set(opcode, `SWAP${opcode - 0x8f}`);
}

for (let opcode = 0xa0; opcode <= 0xa4; opcode += 1) {
  opcodeNames.set(opcode, `LOG${opcode - 0xa0}`);
}

export function normalizeBytecode(input: string): string {
  const compact = input.replace(/\s+/g, "").toLowerCase();
  const withoutPrefix = compact.startsWith("0x") ? compact.slice(2) : compact;

  if (withoutPrefix.length === 0) {
    return "0x";
  }

  if (!/^[0-9a-f]+$/.test(withoutPrefix)) {
    throw new Error("Input is not valid hexadecimal bytecode");
  }

  const evenHex = withoutPrefix.length % 2 === 0 ? withoutPrefix : `0${withoutPrefix}`;
  return `0x${evenHex}`;
}

export function byteLength(bytecode: string): number {
  const normalized = normalizeBytecode(bytecode);
  return (normalized.length - 2) / 2;
}

export function disassembleBytecode(bytecode: string): Opcode[] {
  const normalized = normalizeBytecode(bytecode).slice(2);
  const bytes = normalized.match(/.{1,2}/g)?.map((hex) => Number.parseInt(hex, 16)) ?? [];
  const opcodes: Opcode[] = [];

  for (let pc = 0; pc < bytes.length; pc += 1) {
    const code = bytes[pc] ?? 0;
    const name = opcodeNames.get(code) ?? `UNKNOWN_0x${code.toString(16).padStart(2, "0")}`;

    if (code >= 0x60 && code <= 0x7f) {
      const pushBytes = code - 0x5f;
      const dataStart = pc + 1;
      const dataEnd = Math.min(dataStart + pushBytes, bytes.length);
      const pushData = bytes.slice(dataStart, dataEnd).map(toHexByte).join("");
      opcodes.push({ pc, code, name, pushData });
      pc += pushBytes;
      continue;
    }

    opcodes.push({ pc, code, name });
  }

  return opcodes;
}

export function countOpcodeNames(opcodes: Opcode[]): Record<string, number> {
  return opcodes.reduce<Record<string, number>>((counts, opcode) => {
    counts[opcode.name] = (counts[opcode.name] ?? 0) + 1;
    return counts;
  }, {});
}

export function opcodeCount(counts: Record<string, number>, names: string[]): number {
  return names.reduce((total, name) => total + (counts[name] ?? 0), 0);
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}
