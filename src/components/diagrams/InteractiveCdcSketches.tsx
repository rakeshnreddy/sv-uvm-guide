"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Sketch {
  id: string;
  title: string;
  description: string;
  svgContent: React.ReactElement;
}

const TwoFlopSynchronizer: React.ReactElement = (
  <g>
    {/* Clock A Domain */}
    <rect x="50" y="100" width="100" height="120" rx="5" fill="#f0f8ff" stroke="#add8e6" strokeWidth="1" />
    <text x="100" y="90" textAnchor="middle" fontSize="12" fill="#4682b4">Clock Domain A</text>
    <text x="70" y="120" fontSize="14">D</text>
    <rect x="80" y="100" width="40" height="40" rx="3" fill="#e6e6fa" stroke="#9370db" />
    <text x="100" y="125" textAnchor="middle">FF1</text>
    <text x="125" y="120" fontSize="14">Q</text>
    <text x="70" y="160" fontSize="10">clkA</text>
    <line x1="80" y1="130" x2="70" y2="140" stroke="#9370db" />
    <line x1="70" y1="140" x2="80" y2="150" stroke="#9370db" />

    {/* Clock B Domain */}
    <rect x="250" y="100" width="100" height="120" rx="5" fill="#fff0f5" stroke="#ffb6c1" strokeWidth="1" />
    <text x="300" y="90" textAnchor="middle" fontSize="12" fill="#c71585">Clock Domain B</text>
    <text x="270" y="120" fontSize="14">D</text>
    <rect x="280" y="100" width="40" height="40" rx="3" fill="#e6e6fa" stroke="#9370db" />
    <text x="300" y="125" textAnchor="middle">FF2</text>
    <text x="325" y="120" fontSize="14">Q_sync</text>
    <text x="270" y="160" fontSize="10">clkB</text>
    <line x1="280" y1="130" x2="270" y2="140" stroke="#9370db" />
    <line x1="270" y1="140" x2="280" y2="150" stroke="#9370db" />

    {/* Connection */}
    <line x1="120" y1="120" x2="280" y2="120" stroke="#ffa07a" strokeWidth="2" strokeDasharray="4 2" />
    <text x="190" y="115" fill="#ffa07a" fontSize="10">metastable prone</text>
  </g>
);

const MuxHandshakeSynchronizer: React.ReactElement = (
  <g>
    {/* Domain A (Sender) */}
    <rect x="50" y="100" width="180" height="180" rx="5" fill="#f0f8ff" stroke="#add8e6" />
    <text x="140" y="90" textAnchor="middle" fontSize="12">Domain A (clkA)</text>
    <text x="60" y="120">data_a</text>
    <rect x="100" y="130" width="60" height="30" fill="#e6e6fa" stroke="#9370db" />
    <text x="130" y="150" textAnchor="middle">REG_A</text>
    <text x="60" y="190">req_a</text>
    <circle cx="130" cy="200" r="15" fill="#e6e6fa" stroke="#9370db" />
    <text x="130" y="205" textAnchor="middle">FF</text>
    <line x1="160" y1="145" x2="190" y2="145" stroke="#333" /> {/* data_a out */}
    <line x1="130" y1="215" x2="130" y2="240" stroke="#333" /> {/* req_a out */}
    <text x="135" y="235" fontSize="10">req_sync_a</text>

    {/* Domain B (Receiver) */}
    <rect x="350" y="100" width="180" height="210" rx="5" fill="#fff0f5" stroke="#ffb6c1" />
    <text x="440" y="90" textAnchor="middle" fontSize="12">Domain B (clkB)</text>
    {/* 2-flop for req */}
    <rect x="380" y="130" width="30" height="30" fill="#e6e6fa" stroke="#9370db" /><text x="395" y="150">FF</text>
    <rect x="430" y="130" width="30" height="30" fill="#e6e6fa" stroke="#9370db" /><text x="445" y="150">FF</text>
    <line x1="360" y1="145" x2="380" y2="145" stroke="#ffa07a" strokeDasharray="4 2" /> <text x="370" y="140" fontSize="8">req_a</text>
    <line x1="410" y1="145" x2="430" y2="145" stroke="#333" />
    <line x1="460" y1="145" x2="480" y2="145" stroke="#333" /> <text x="485" y="150" fontSize="10">req_b</text>
    {/* MUX */}
    <polygon points="390,190 440,170 440,210" fill="#e6e6fa" stroke="#9370db" /> <text x="415" y="195">MUX</text>
    <line x1="370" y1="180" x2="390" y2="190" stroke="#ffa07a" strokeDasharray="4 2" /> <text x="365" y="175" fontSize="8">data_a_sync</text>
    <line x1="370" y1="200" x2="390" y2="193" stroke="#333" /> <text x="365" y="210" fontSize="8">reg_b_feedback</text>
    <line x1="440" y1="190" x2="460" y2="190" stroke="#333" />
    <rect x="460" y="175" width="60" height="30" fill="#e6e6fa" stroke="#9370db" /> <text x="490" y="195">REG_B</text>
    <text x="525" y="195">data_b</text>
    {/* ack path */}
    <text x="470" y="230">ack_b</text>
    <circle cx="440" cy="240" r="15" fill="#e6e6fa" stroke="#9370db" /> <text x="440" y="245" textAnchor="middle">FF</text>
    <line x1="440" y1="255" x2="440" y2="280" stroke="#333" />
    {/* ack sync to Domain A */}
    <rect x="230" y="250" width="30" height="30" fill="#e6e6fa" stroke="#9370db" /><text x="245" y="270">FF</text>
    <rect x="180" y="250" width="30" height="30" fill="#e6e6fa" stroke="#9370db" /><text x="195" y="270">FF</text>
    <line x1="260" y1="265" x2="280" y2="265" stroke="#ffa07a" strokeDasharray="4 2" /> <text x="270" y="260" fontSize="8">ack_b_out</text>
    <line x1="210" y1="265" x2="230" y2="265" stroke="#333" />
    <line x1="180" y1="265" x2="160" y2="265" stroke="#333" /> <text x="140" y="270" fontSize="10">ack_a</text>

     {/* CDC Paths */}
    <path d="M 190 145 Q 280 100 370 180" stroke="#ffa07a" strokeWidth="1.5" strokeDasharray="4 2" fill="none" /> {/* data_a to data_a_sync */}
    <path d="M 130 240 Q 250 200 360 145" stroke="#ffa07a" strokeWidth="1.5" strokeDasharray="4 2" fill="none" /> {/* req_sync_a to req_a input of 2-flop */}
    <path d="M 440 280 Q 340 300 280 265" stroke="#ffa07a" strokeWidth="1.5" strokeDasharray="4 2" fill="none" /> {/* ack_b_out to ack sync */}
  </g>
);


const asyncFifoSvg: React.ReactElement = (
    <g>
        {/* Write Domain */}
        <rect x="50" y="80" width="200" height="200" rx="5" fill="#e3f2fd" stroke="#90caf9" />
        <text x="150" y="70" textAnchor="middle" fontSize="12">Write Domain (wr_clk)</text>
        <text x="60" y="100">wr_data</text>
        <line x1="100" y1="95" x2="120" y2="95" stroke="#333" markerEnd="url(#arrowhead-cdc)" />
        <rect x="120" y="110" width="60" height="120" fill="#fff" stroke="#64b5f6" />
        <text x="150" y="170" textAnchor="middle" fontSize="10">FIFO RAM</text>
        <text x="60" y="200">wr_en</text>
        <line x1="90" y1="195" x2="120" y2="195" stroke="#333" markerEnd="url(#arrowhead-cdc)" />

        <rect x="70" y="220" width="80" height="30" fill="#bbdefb" stroke="#64b5f6" />
        <text x="110" y="240" textAnchor="middle" fontSize="10">Write Pointer (Binary)</text>
        <line x1="110" y1="250" x2="110" y2="270" stroke="#333" markerEnd="url(#arrowhead-cdc)" />
        <rect x="70" y="270" width="80" height="30" fill="#bbdefb" stroke="#64b5f6" />
        <text x="110" y="290" textAnchor="middle" fontSize="10">Binary to Gray</text>

        {/* Read Domain */}
        <rect x="350" y="80" width="200" height="200" rx="5" fill="#fce4ec" stroke="#f48fb1" />
        <text x="450" y="70" textAnchor="middle" fontSize="12">Read Domain (rd_clk)</text>
        <text x="540" y="100" textAnchor="end">rd_data</text>
        <line x1="400" y1="95" x2="380" y2="95" stroke="#333" markerStart="url(#arrowhead-cdc-rev)" />
        <rect x="420" y="110" width="60" height="120" fill="#fff" stroke="#f06292" />
        <text x="390" y="170" textAnchor="middle" fontSize="10" transform="translate(60,0) rotate(0)">FIFO RAM (view)</text>
        <text x="540" y="200" textAnchor="end">rd_en</text>
        <line x1="510" y1="195" x2="480" y2="195" stroke="#333" markerStart="url(#arrowhead-cdc-rev)" />

        <rect x="450" y="220" width="80" height="30" fill="#f8bbd0" stroke="#f06292" />
        <text x="490" y="240" textAnchor="middle" fontSize="10">Read Pointer (Binary)</text>
        <line x1="490" y1="250" x2="490" y2="270" stroke="#333" markerEnd="url(#arrowhead-cdc)" />
        <rect x="450" y="270" width="80" height="30" fill="#f8bbd0" stroke="#f06292" />
        <text x="490" y="290" textAnchor="middle" fontSize="10">Binary to Gray</text>

        {/* Gray Pointer Crossing */}
        <path d="M 150 290 Q 250 320 350 290" stroke="#ff8a65" strokeWidth="1.5" strokeDasharray="4 2" fill="none" />
        <text x="250" y="300" textAnchor="middle" fontSize="10" fill="#ff8a65">wr_ptr_gray (to rd_clk domain)</text>
        <rect x="360" y="240" width="60" height="20" fill="#ffe0b2" stroke="#ffb74d" />
        <text x="390" y="253" textAnchor="middle" fontSize="8">Sync FF</text>
         <rect x="360" y="215" width="60" height="20" fill="#ffe0b2" stroke="#ffb74d" />
        <text x="390" y="228" textAnchor="middle" fontSize="8">Sync FF</text>
        <line x1="350" y1="290" x2="390" y2="260" stroke="#ff8a65" strokeWidth="1.5" strokeDasharray="4 2" fill="none" />
        <line x1="390" y1="235" x2="390" y2="210" stroke="#333" />
        <text x="400" y="200" fontSize="10">Full Logic</text>


        <path d="M 450 290 Q 350 320 250 290" stroke="#7986cb" strokeWidth="1.5" strokeDasharray="4 2" fill="none" />
        <text x="350" y="300" textAnchor="middle" fontSize="10" fill="#7986cb">rd_ptr_gray (to wr_clk domain)</text>
        <rect x="200" y="240" width="60" height="20" fill="#c5cae9" stroke="#7986cb" />
        <text x="230" y="253" textAnchor="middle" fontSize="8">Sync FF</text>
        <rect x="200" y="215" width="60" height="20" fill="#c5cae9" stroke="#7986cb" />
        <text x="230" y="228" textAnchor="middle" fontSize="8">Sync FF</text>
        <line x1="250" y1="290" x2="230" y2="260" stroke="#7986cb" strokeWidth="1.5" strokeDasharray="4 2" fill="none" />
        <line x1="230" y1="235" x2="230" y2="210" stroke="#333" />
        <text x="180" y="200" fontSize="10">Empty Logic</text>

        <defs>
            <marker id="arrowhead-cdc" markerWidth="7" markerHeight="5" refX="6.5" refY="2.5" orient="auto">
                <polygon points="0 0, 7 2.5, 0 5" fill="#333" />
            </marker>
            <marker id="arrowhead-cdc-rev" markerWidth="7" markerHeight="5" refX="0.5" refY="2.5" orient="auto">
                <polygon points="7 0, 0 2.5, 7 5" fill="#333" />
            </marker>
        </defs>
    </g>
);


const sketches: Sketch[] = [
  { id: 'twoFlop', title: '2-Flop Synchronizer', description: 'A basic synchronizer for single-bit signals. The first flop samples the asynchronous input, potentially going metastable. The second flop resolves metastability, providing a synchronized output after a delay.', svgContent: TwoFlopSynchronizer },
  { id: 'muxHandshake', title: 'MUX Handshake Synchronizer', description: 'Used for multi-bit data. Sender holds data and asserts a request. Receiver synchronizes request, captures data, and asserts acknowledge. Sender de-asserts request upon seeing synchronized acknowledge.', svgContent: MuxHandshakeSynchronizer },
  { id: 'asyncFifo', title: 'Asynchronous FIFO Pointers', description: 'Uses Gray-coded pointers to determine full/empty status. Gray code ensures only one bit changes at a time, simplifying synchronization of pointers between clock domains.', svgContent: asyncFifoSvg },
];

const InteractiveCdcSketches: React.FC = () => {
  const [selectedSketch, setSelectedSketch] = useState<Sketch>(sketches[0]);

  return (
    <div style={{ display: 'flex', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '250px', borderRight: '1px solid #eee', padding: '10px' }}>
        <h3 style={{ marginTop: 0 }}>CDC Techniques</h3>
        {sketches.map(sketch => (
          <motion.div
            key={sketch.id}
            onClick={() => setSelectedSketch(sketch)}
            style={{
              padding: '10px',
              margin: '5px 0',
              cursor: 'pointer',
              backgroundColor: selectedSketch.id === sketch.id ? '#e3f2fd' : 'transparent',
              borderRadius: '5px',
              fontWeight: selectedSketch.id === sketch.id ? 'bold' : 'normal',
            }}
            whileHover={{ backgroundColor: '#f1f8e9' }}
          >
            {sketch.title}
          </motion.div>
        ))}
      </div>
      <div style={{ flex: 1, padding: '20px' }}>
        <h4>{selectedSketch.title}</h4>
        <p style={{fontSize: '13px', color: '#555'}}>{selectedSketch.description}</p>
        <motion.svg
            width="100%"
            height="400"
            viewBox="0 0 600 400" // Adjusted viewBox
            key={selectedSketch.id} // Ensures re-render on sketch change
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            transition={{duration: 0.5}}
        >
          {selectedSketch.svgContent}
        </motion.svg>
      </div>
    </div>
  );
};

export default InteractiveCdcSketches;
