'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// simplified UVM hierarchy tree
type UvmComponent = {
  id: string;
  name: string;
  path: string;
  children?: UvmComponent[];
};

const uvmTree: UvmComponent = {
  id: 'top',
  name: 'uvm_test_top',
  path: 'uvm_test_top',
  children: [
    {
      id: 'env',
      name: 'env',
      path: 'uvm_test_top.env',
      children: [
        {
          id: 'agent0',
          name: 'agent0',
          path: 'uvm_test_top.env.agent0',
          children: [
            { id: 'drv0', name: 'driver', path: 'uvm_test_top.env.agent0.driver' },
            { id: 'mon0', name: 'monitor', path: 'uvm_test_top.env.agent0.monitor' }
          ]
        },
        {
          id: 'agent1',
          name: 'agent1',
          path: 'uvm_test_top.env.agent1',
          children: [
            { id: 'drv1', name: 'driver', path: 'uvm_test_top.env.agent1.driver' },
            { id: 'mon1', name: 'monitor', path: 'uvm_test_top.env.agent1.monitor' }
          ]
        },
        {
          id: 'scb',
          name: 'scoreboard',
          path: 'uvm_test_top.env.scoreboard'
        }
      ]
    }
  ]
};

// Simple glob matcher for uvm paths (* matches anything)
function globMatch(pattern: string, text: string): boolean {
  // Convert UVM wildcard (*) to Regex (.*)
  const regexPattern = '^' + pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
  return new RegExp(regexPattern).test(text);
}

export default function ConfigDbExplorer() {
  const [callerContext, setCallerContext] = useState<string>('uvm_test_top');
  const [targetString, setTargetString] = useState<string>('env.agent*.driver');
  const [isSetting, setIsSetting] = useState(false);

  // Combine context and target string as UVM does: {context.get_full_name(), ".", inst_name}
  const resolvedPathPattern = useMemo(() => {
    let base = callerContext === '' ? '' : callerContext;
    if (base && targetString) { base += '.'; }
    return base + targetString;
  }, [callerContext, targetString]);

  const handleSetConfig = () => {
    setIsSetting(true);
    setTimeout(() => setIsSetting(false), 2000);
  };

  const flattenTree = (node: UvmComponent): Array<UvmComponent & { isMatch: boolean }> => {
    const list: Array<UvmComponent & { isMatch: boolean }> = [];
    const traverse = (n: UvmComponent) => {
      list.push({ ...n, isMatch: globMatch(resolvedPathPattern, n.path) });
      n.children?.forEach(traverse);
    };
    traverse(node);
    return list;
  };

  const flatNodes = flattenTree(uvmTree);
  const matchCount = flatNodes.filter(n => n.isMatch).length;

  return (
    <div className="my-8 rounded-xl border border-border bg-slate-900 overflow-hidden shadow-lg">
      <div className="border-b border-border bg-slate-800/50 px-6 py-4">
        <h3 className="text-lg font-bold text-slate-100">uvm_config_db Precedence & Matching</h3>
        <p className="text-sm text-slate-400 mt-1">
          Explore how the context (<code>cntxt</code>) and string (<code>inst_name</code>) combine to target specific components in the hierarchy.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Controls - Left Side */}
        <div className="flex-1 border-r border-border p-6 bg-slate-800/20">
          <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm border border-slate-700 shadow-inner mb-6">
            <div className="text-purple-400">uvm_config_db<span className="text-slate-300">#(virtual apb_if)::</span><span className="text-blue-400">set</span><span className="text-slate-300">(</span></div>
            <div className="ml-4 mt-2 flex items-center">
              <span className="text-slate-500 w-16 inline-block">cntxt:</span>
              <select 
                value={callerContext}
                onChange={(e) => setCallerContext(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-600 rounded px-2 py-1 outline-none ring-primary focus:ring-1"
              >
                <option value="">null (Global)</option>
                <option value="uvm_test_top">this (uvm_test_top)</option>
                <option value="uvm_test_top.env">this (env)</option>
              </select>
              <span className="text-slate-300 ml-2">,</span>
            </div>
            
            <div className="ml-4 mt-2 flex items-center">
              <span className="text-slate-500 w-16 inline-block">inst_name:</span>
              <span className="text-green-400">"</span>
              <input 
                type="text" 
                value={targetString}
                onChange={(e) => setTargetString(e.target.value)}
                className="bg-transparent border-b border-slate-600 text-green-400 w-48 outline-none focus:border-green-400 focus:bg-slate-800/50 px-1"
                placeholder="e.g. *, env.agent0, etc."
                spellCheck="false"
              />
              <span className="text-green-400">"</span>
              <span className="text-slate-300 ml-2">,</span>
            </div>

            <div className="ml-4 mt-2 text-slate-300">
              <span className="text-slate-500 w-16 inline-block">field:</span>
              <span className="text-green-400">"vif"</span>,
            </div>
            <div className="ml-4 mt-2 text-slate-300">
              <span className="text-slate-500 w-16 inline-block">value:</span>
              vif_instance
            </div>
            <div className="text-slate-300 mt-2">);</div>
          </div>

          <div className="mt-4 p-4 rounded bg-slate-800/50 border border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Resolved UVM Glob Path:</h4>
            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-amber-300 block overflow-hidden text-ellipsis whitespace-nowrap">
              {resolvedPathPattern || "<empty>"}   
            </code>
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-700">
              UVM concatenates the caller's full hierarchical name with the target string. 
              <br/><br/>
              A <code>get()</code> call deep in the hierarchy will only succeed if the caller's <code>get_full_name()</code> precisely matches this resolved glob pattern.
            </p>
          </div>

          <button 
            onClick={handleSetConfig}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition-colors active:scale-95"
          >
            Execute set()
          </button>
        </div>

        {/* Visualization - Right Side */}
        <div className="flex-[1.5] p-6 bg-slate-900 relative">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-sm font-semibold text-slate-300">Component Hierarchy</h4>
            <div className="text-xs font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700">
              <span className={matchCount > 0 ? "text-emerald-400" : "text-slate-400"}>
                {matchCount} component{matchCount !== 1 ? 's' : ''} matched
              </span>
            </div>
          </div>

          <div className="font-mono text-sm relative">
            <AnimatePresence>
              {isSetting && (
                <motion.div 
                  initial={{ opacity: 0, top: 0, scale: 1.1 }}
                  animate={{ opacity: [0, 1, 0], top: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5 }}
                  className="absolute inset-0 bg-blue-500/10 z-0 pointer-events-none rounded"
                />
              )}
            </AnimatePresence>

            {flatNodes.map((node) => {
              // Calculate indent based on dot count
              const depth = node.path.split('.').length - 1;
              const isMatch = node.isMatch;
              
              return (
                <div 
                  key={node.path}
                  className={`relative z-10 py-1.5 px-3 mb-1 rounded flex items-center transition-colors duration-300 ${
                    isMatch 
                      ? 'bg-emerald-900/40 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                      : 'bg-slate-800/30 border border-transparent text-slate-500'
                  }`}
                  style={{ marginLeft: `${depth * 24}px` }}
                >
                  {isMatch && (
                    <motion.div 
                      layoutId={`match-indicator-${node.path}`}
                      className="absolute -left-2 top-0 bottom-0 w-1 bg-emerald-500 rounded-full"
                    />
                  )}
                  
                  <span className={`mr-2 ${isMatch ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {depth === 0 ? '📦' : depth === 1 ? '📁' : depth === 2 ? '⚙️' : '📄'}
                  </span>
                  
                  <span className={`${isMatch ? 'text-slate-200' : 'text-slate-500'} font-medium`}>
                    {node.name}
                  </span>
                  
                  {isMatch && isSetting && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800"
                    >
                      config received
                    </motion.span>
                  )}
                </div>
              );
            })}
          </div>
          
        </div>
      </div>
    </div>
  );
}
