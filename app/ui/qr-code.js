// Small QR code generator (byte mode, UTF-8), written for CampusWay so that
// share codes work offline without a third-party library.
// Follows ISO/IEC 18004: Reed-Solomon error correction, all 8 masks with the
// standard penalty rules, versions 1-40.
//
//   const qr = CampusQR.encode('https://example.org', 'M');
//   qr.size, qr.get(x, y), CampusQR.toSvg(qr)
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusQR = api;
})(typeof self !== 'undefined' ? self : this, function(){

  const LEVELS = {L:0, M:1, Q:2, H:3};
  const FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H

  // Error-correction codewords per block, by level then version.
  const ECC_PER_BLOCK = [
    [-1, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  // Number of error-correction blocks, by level then version.
  const BLOCKS = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];

  function rawDataModules(version){
    let result = (16 * version + 128) * version + 64;
    if(version >= 2){
      const align = Math.floor(version / 7) + 2;
      result -= (25 * align - 10) * align - 55;
      if(version >= 7) result -= 36;
    }
    return result;
  }

  function dataCodewords(version, level){
    return Math.floor(rawDataModules(version) / 8) -
      ECC_PER_BLOCK[level][version] * BLOCKS[level][version];
  }

  function alignmentPositions(version){
    if(version === 1) return [];
    const size = version * 4 + 17;
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const result = [6];
    for(let position = size - 7; result.length < count; position -= step) result.splice(1, 0, position);
    return result;
  }

  // Galois field GF(2^8) with the QR polynomial 0x11D.
  function gfMultiply(x, y){
    let z = 0;
    for(let i = 7; i >= 0; i -= 1){
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree){
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for(let i = 0; i < degree; i += 1){
      for(let j = 0; j < result.length; j += 1){
        result[j] = gfMultiply(result[j], root);
        if(j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMultiply(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor){
    const result = divisor.map(() => 0);
    for(const byte of data){
      const factor = byte ^ result.shift();
      result.push(0);
      divisor.forEach((coefficient, index) => {
        result[index] ^= gfMultiply(coefficient, factor);
      });
    }
    return result;
  }

  function utf8Bytes(text){
    if(typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text)), char => char.charCodeAt(0));
  }

  function encode(text, levelName = 'M'){
    const level = LEVELS[levelName] ?? LEVELS.M;
    const bytes = utf8Bytes(String(text));

    let version = 1;
    for(; version <= 40; version += 1){
      const countBits = version <= 9 ? 8 : 16;
      if(4 + countBits + bytes.length * 8 <= dataCodewords(version, level) * 8) break;
    }
    if(version > 40) throw new Error('Text is too long for a QR code');

    // Mode, length, data, terminator and padding.
    const bits = [];
    const put = (value, length) => {
      for(let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, version <= 9 ? 8 : 16);
    bytes.forEach(byte => put(byte, 8));
    const capacity = dataCodewords(version, level) * 8;
    put(0, Math.min(4, capacity - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for(let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) put(pad, 8);

    const data = [];
    for(let i = 0; i < bits.length; i += 8){
      data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
    }

    // Split into blocks, add error correction, interleave.
    const blockCount = BLOCKS[level][version];
    const eccLength = ECC_PER_BLOCK[level][version];
    const rawCodewords = Math.floor(rawDataModules(version) / 8);
    const shortBlocks = blockCount - rawCodewords % blockCount;
    const shortLength = Math.floor(rawCodewords / blockCount);
    const divisor = rsDivisor(eccLength);
    const blocks = [];
    for(let i = 0, offset = 0; i < blockCount; i += 1){
      const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
      const blockData = data.slice(offset, offset + length);
      offset += length;
      const block = blockData.concat(rsRemainder(blockData, divisor));
      if(i < shortBlocks) block.splice(shortLength - eccLength, 0, null);
      blocks.push(block);
    }
    const codewords = [];
    for(let i = 0; i < blocks[0].length; i += 1){
      blocks.forEach(block => {
        if(block[i] !== null) codewords.push(block[i]);
      });
    }

    const size = version * 4 + 17;
    const modules = Array.from({length:size}, () => new Array(size).fill(false));
    const reserved = Array.from({length:size}, () => new Array(size).fill(false));
    const set = (x, y, dark) => {
      modules[y][x] = dark;
      reserved[y][x] = true;
    };

    for(let i = 0; i < size; i += 1){
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    for(const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]){
      for(let dy = -4; dy <= 4; dy += 1){
        for(let dx = -4; dx <= 4; dx += 1){
          const x = cx + dx, y = cy + dy;
          if(x < 0 || y < 0 || x >= size || y >= size) continue;
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          set(x, y, distance !== 2 && distance !== 4);
        }
      }
    }
    const positions = alignmentPositions(version);
    positions.forEach((ay, i) => positions.forEach((ax, j) => {
      const last = positions.length - 1;
      if((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for(let dy = -2; dy <= 2; dy += 1){
        for(let dx = -2; dx <= 2; dx += 1){
          set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }));

    const drawFormat = mask => {
      const value = (FORMAT_BITS[level] << 3) | mask;
      let remainder = value;
      for(let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
      const format = ((value << 10) | remainder) ^ 0x5412;
      const bit = i => ((format >>> i) & 1) === 1;
      for(let i = 0; i <= 5; i += 1) set(8, i, bit(i));
      set(8, 7, bit(6));
      set(8, 8, bit(7));
      set(7, 8, bit(8));
      for(let i = 9; i < 15; i += 1) set(14 - i, 8, bit(i));
      for(let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(i));
      for(let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);

    if(version >= 7){
      let remainder = version;
      for(let i = 0; i < 12; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1F25);
      const versionBits = (version << 12) | remainder;
      for(let i = 0; i < 18; i += 1){
        const dark = ((versionBits >>> i) & 1) === 1;
        const a = size - 11 + i % 3, b = Math.floor(i / 3);
        set(a, b, dark);
        set(b, a, dark);
      }
    }

    // Data in the two-column zigzag, skipping reserved modules.
    let bitIndex = 0;
    for(let right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let vertical = 0; vertical < size; vertical += 1){
        for(let j = 0; j < 2; j += 1){
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if(!reserved[y][x] && bitIndex < codewords.length * 8){
            modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
            bitIndex += 1;
          }
        }
      }
    }

    const maskTest = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      x => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
    ];
    const applyMask = mask => {
      for(let y = 0; y < size; y += 1){
        for(let x = 0; x < size; x += 1){
          if(!reserved[y][x] && maskTest[mask](x, y)) modules[y][x] = !modules[y][x];
        }
      }
    };

    const penalty = () => {
      let score = 0;
      const lineScore = line => {
        let total = 0, run = 1;
        for(let i = 1; i <= line.length; i += 1){
          if(i < line.length && line[i] === line[i - 1]){ run += 1; continue; }
          if(run >= 5) total += run - 2;
          run = 1;
        }
        const text = line.map(dark => dark ? '1' : '0').join('');
        for(const pattern of ['10111010000', '00001011101']){
          for(let at = text.indexOf(pattern); at >= 0; at = text.indexOf(pattern, at + 1)) total += 40;
        }
        return total;
      };
      for(let y = 0; y < size; y += 1) score += lineScore(modules[y]);
      for(let x = 0; x < size; x += 1) score += lineScore(modules.map(row => row[x]));
      let dark = 0;
      for(let y = 0; y < size; y += 1){
        for(let x = 0; x < size; x += 1){
          if(modules[y][x]) dark += 1;
          if(x < size - 1 && y < size - 1){
            const value = modules[y][x];
            if(value === modules[y][x + 1] && value === modules[y + 1][x] && value === modules[y + 1][x + 1]) score += 3;
          }
        }
      }
      score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return score;
    };

    let bestMask = 0, bestScore = Infinity;
    for(let mask = 0; mask < 8; mask += 1){
      applyMask(mask);
      drawFormat(mask);
      const score = penalty();
      if(score < bestScore){ bestScore = score; bestMask = mask; }
      applyMask(mask);
    }
    applyMask(bestMask);
    drawFormat(bestMask);

    return {
      version,
      size,
      mask: bestMask,
      get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && modules[y][x]
    };
  }

  // SVG markup with a quiet zone; dark modules are one path.
  function toSvg(qr, options = {}){
    const border = options.border ?? 4;
    const dark = options.dark || '#000';
    const light = options.light || '#fff';
    const total = qr.size + border * 2;
    let path = '';
    for(let y = 0; y < qr.size; y += 1){
      for(let x = 0; x < qr.size; x += 1){
        if(qr.get(x, y)) path += `M${x + border},${y + border}h1v1h-1z`;
      }
    }
    const label = options.label ? ` role="img" aria-label="${String(options.label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"${label}><rect width="100%" height="100%" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  }

  return {encode, toSvg};
});
