"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var curriculum_data_1 = require("../src/lib/cjs/curriculum-data");
var mdxFiles = [
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-virtual-sequencer.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/connecting.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-monitor.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-sequence-item.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-libraries.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/virtual-sequences.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-scoreboard.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-arbitration.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/environment-test-classes.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/sequencer-driver-handshake.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/interrupt-handling.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/layered-sequences.mdx",
    "content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-subscriber.mdx",
    "content/curriculum/T3_Advanced/A-UVM-3_Advanced_UVM_Techniques/index.mdx",
    "content/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/frontdoor-vs-backdoor.mdx",
    "content/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/explicit-vs-implicit.mdx",
    "content/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/built-in-ral-sequences.mdx",
    "content/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/index.mdx",
    "content/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/heartbeats.mdx",
    "content/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/uvm-callbacks.mdx",
    "content/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/index.mdx",
    "content/curriculum/T2_Intermediate/I-SV-1_OOP/constructors.mdx",
    "content/curriculum/T2_Intermediate/I-SV-1_OOP/parameterized-classes.mdx",
    "content/curriculum/T2_Intermediate/I-SV-1_OOP/index.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-resource-db.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-config-db.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-3_Sequences/index.mdx",
    "content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/mailboxes.mdx",
    "content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/semaphores.mdx",
    "content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/linking-coverage.mdx",
    "content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/coverage-options.mdx",
    "content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/index.mdx",
    "content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/events.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro/index.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/domains-phase-jumping.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/uvm-event-barrier.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/index.mdx",
    "content/curriculum/T2_Intermediate/I-SV-4_Assertions_SVA/local-variables.mdx",
    "content/curriculum/T2_Intermediate/I-SV-4_Assertions_SVA/multi-clocking.mdx",
    "content/curriculum/T2_Intermediate/I-SV-4_Assertions_SVA/immediate-vs-concurrent.mdx",
    "content/curriculum/T2_Intermediate/I-SV-4_Assertions_SVA/index.mdx",
    "content/curriculum/T2_Intermediate/I-SV-2_Constrained_Randomization/controlling-randomization.mdx",
    "content/curriculum/T2_Intermediate/I-SV-2_Constrained_Randomization/constraint-blocks.mdx",
    "content/curriculum/T2_Intermediate/I-SV-2_Constrained_Randomization/advanced-constraints.mdx",
    "content/curriculum/T2_Intermediate/I-SV-2_Constrained_Randomization/index.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-2_Building_TB/uvm-root.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-2_Building_TB/uvm-report-server.mdx",
    "content/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index.mdx",
    "content/curriculum/uvm-core/fundamentals/phasing.mdx",
    "content/curriculum/uvm-core/fundamentals/factory.mdx",
    "content/curriculum/uvm-core/fundamentals/component-communication.mdx",
    "content/curriculum/uvm-core/fundamentals/base-classes.mdx",
    "content/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/regression-triage.mdx",
    "content/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/coverage-closure.mdx",
    "content/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/index.mdx",
    "content/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index.mdx",
    "content/curriculum/T4_Expert/E-INT-1_Integrating_UVM_with_Formal_Verification/pss.mdx",
    "content/curriculum/T4_Expert/E-INT-1_Integrating_UVM_with_Formal_Verification/dpi.mdx",
    "content/curriculum/T4_Expert/E-INT-1_Integrating_UVM_with_Formal_Verification/index.mdx",
    "content/curriculum/T4_Expert/E-PERF-1_UVM_Performance/index.mdx",
    "content/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/reusable-vip.mdx",
    "content/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/effective-debug.mdx",
    "content/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index.mdx",
    "content/curriculum/uvm-building/essentials/architecture-overview.mdx",
    "content/curriculum/uvm-building/essentials/stimulus-generation.mdx",
    "content/curriculum/uvm-building/essentials/agents-and-environment.mdx",
    "content/curriculum/uvm-building/essentials/analysis-components.mdx",
    "content/curriculum/T1_Foundational/F1_Why_Verification/index.mdx",
    "content/curriculum/T1_Foundational/F2_SystemVerilog_Primer/index.mdx",
    "content/curriculum/T1_Foundational/F2_Data_Types/user-defined.mdx",
    "content/curriculum/T1_Foundational/F2_Data_Types/arrays.mdx",
    "content/curriculum/T1_Foundational/F2_Data_Types/index.mdx",
    "content/curriculum/T1_Foundational/F3_SystemVerilog_Intro/index.mdx",
    "content/curriculum/T1_Foundational/F4_RTL_and_Testbench_Constructs/program-clocking.mdx",
    "content/curriculum/T1_Foundational/F4_RTL_and_Testbench_Constructs/packages.mdx",
    "content/curriculum/T1_Foundational/F4_RTL_and_Testbench_Constructs/interfaces.mdx",
    "content/curriculum/T1_Foundational/F4_RTL_and_Testbench_Constructs/index.mdx",
    "content/curriculum/T1_Foundational/F4_Your_First_Testbench/index.mdx",
    "content/curriculum/T1_Foundational/F3_Procedural_Constructs/tasks-functions.mdx",
    "content/curriculum/T1_Foundational/F3_Procedural_Constructs/flow-control.mdx",
    "content/curriculum/T1_Foundational/F3_Procedural_Constructs/fork-join.mdx",
    "content/curriculum/T1_Foundational/F3_Procedural_Constructs/index.mdx",
];
var allTopics = [];
curriculum_data_1.curriculumData.forEach(function (m) {
    m.sections.forEach(function (s) {
        s.topics.forEach(function (t) {
            allTopics.push(__assign(__assign({}, t), { slug: "".concat(m.slug, "/").concat(s.slug, "/").concat(t.slug) }));
        });
    });
});
mdxFiles.forEach(function (file) {
    if (fs.existsSync(file)) {
        var content = fs.readFileSync(file, "utf-8");
        var frontmatter = content.match(/---([\s\S]*?)---/);
        if (frontmatter) {
            var titleMatch = frontmatter[1].match(/title:\s*"(.*?)"/);
            if (titleMatch) {
                var title = titleMatch[1];
                var slug_1 = file.replace("content/curriculum/", "").replace(".mdx", "").replace(/\\/g, "/");
                var topic = allTopics.find(function (t) { return t.slug === slug_1; });
                if (topic && topic.title !== title) {
                    console.log("Mismatch found in ".concat(file, ":"));
                    console.log("  Frontmatter title: \"".concat(title, "\""));
                    console.log("  curriculumData title: \"".concat(topic.title, "\""));
                }
            }
        }
    }
    else {
        console.log("File not found: ".concat(file));
    }
});
