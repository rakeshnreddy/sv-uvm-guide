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
exports.curriculumData = void 0;
exports.findTopicBySlug = findTopicBySlug;
exports.getBreadcrumbs = getBreadcrumbs;
exports.findPrevNextTopics = findPrevNextTopics;
exports.curriculumData = [
    {
        title: "Foundational",
        slug: "T1_Foundational",
        tier: "T1",
        sections: [
            {
                title: "Why Verification?",
                slug: "F1_Why_Verification",
                topics: [
                    { title: "Why Verification", slug: "index", description: "An introduction to the world of hardware verification." }
                ]
            },
            {
                title: "Data Types",
                slug: "F2_Data_Types",
                topics: [
                    { title: "Data Types", slug: "index", description: "Exploring SystemVerilog's data types." },
                ]
            },
            {
                title: "Procedural Constructs",
                slug: "F3_Procedural_Constructs",
                topics: [
                    { title: "Procedural Constructs", slug: "index", description: "Understanding the building blocks of SystemVerilog code." },
                ]
            },
            {
                title: "RTL and Testbench Constructs",
                slug: "F4_RTL_and_Testbench_Constructs",
                topics: [
                    { title: "RTL and Testbench Constructs", slug: "index", description: "Key constructs for design and verification." },
                ]
            },
        ],
    },
    {
        title: "Intermediate",
        slug: "T2_Intermediate",
        tier: "T2",
        sections: [
            {
                title: "Object-Oriented Programming",
                slug: "I-SV-1_OOP",
                topics: [
                    { title: "Object-Oriented Programming", slug: "index", description: "The fundamentals of OOP in SystemVerilog." },
                ]
            },
            {
                title: "Constrained Randomization",
                slug: "I-SV-2_Constrained_Randomization",
                topics: [
                    { title: "Constrained Randomization", slug: "index", description: "Generating random data with constraints." },
                ]
            },
            {
                title: "Functional Coverage",
                slug: "I-SV-3_Functional_Coverage",
                topics: [
                    { title: "Functional Coverage", slug: "index", description: "Measuring verification effectiveness." },
                ]
            },
            {
                title: "SystemVerilog Assertions (SVA)",
                slug: "I-SV-4_Assertions_SVA",
                topics: [
                    { title: "SystemVerilog Assertions (SVA)", slug: "index", description: "Using SystemVerilog Assertions for verification." },
                ]
            },
            {
                title: "UVM Introduction: Objects, Components, and Factory",
                slug: "I-UVM-1_UVM_Intro",
                topics: [
                    { title: "UVM Introduction", slug: "index", description: "An introduction to the Universal Verification Methodology." },
                ]
            },
            {
                title: "Building a UVM Testbench: Components & Hierarchy",
                slug: "I-UVM-2_Building_TB",
                topics: [
                    { title: "Building a UVM Testbench", slug: "index", description: "Exploring the foundational classes of UVM." },
                ]
            },
            {
                title: "Basic UVM Sequences and Stimulus Generation",
                slug: "I-UVM-3_Sequences",
                topics: [
                    { title: "Basic UVM Sequences", slug: "index", description: "How UVM components talk to each other." },
                ]
            }
        ]
    },
    {
        title: "The UVM Universe - Core Concepts",
        slug: "uvm-core",
        tier: "T2",
        sections: [
            {
                title: "Fundamentals",
                slug: "fundamentals",
                topics: [
                    { title: "UVM Base Classes", slug: "base-classes", description: "uvm_object vs uvm_component." },
                    { title: "Component Communication", slug: "component-communication", description: "TLM ports and analysis ports." },
                    { title: "Factory", slug: "factory", description: "Factory overrides and creation." },
                    { title: "Phasing", slug: "phasing", description: "UVM phasing mechanism." }
                ]
            }
        ]
    },
    {
        title: "Building a UVM Testbench",
        slug: "uvm-building",
        tier: "T2",
        sections: [
            {
                title: "Essentials",
                slug: "essentials",
                topics: [
                    { title: "Architecture Overview", slug: "architecture-overview", description: "Overview of a UVM testbench." },
                    { title: "Stimulus Generation", slug: "stimulus-generation", description: "Sequences and driver handshake." },
                    { title: "Analysis Components", slug: "analysis-components", description: "Monitors, subscribers, scoreboards." },
                    { title: "Agents and Environment", slug: "agents-and-environment", description: "Agent vs environment." }
                ]
            }
        ]
    },
    {
        title: "Advanced",
        slug: "T3_Advanced",
        tier: "T3",
        sections: [
            {
                title: "Advanced UVM Sequencing",
                slug: "A-UVM-1_Advanced_Sequencing",
                topics: [
                    { title: "Advanced UVM Sequencing", slug: "index", description: "Sophisticated stimulus generation techniques." },
                ]
            },
            {
                title: "The UVM Factory In-Depth",
                slug: "A-UVM-2_The_UVM_Factory_In-Depth",
                topics: [
                    { title: "The UVM Factory In-Depth", slug: "index", description: "A deeper dive into the UVM factory." },
                ]
            },
            {
                title: "The UVM Register Abstraction Layer (RAL)",
                slug: "A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL",
                topics: [
                    { title: "The UVM Register Abstraction Layer (RAL)", slug: "index", description: "Simplifying register access in UVM." },
                ]
            },
        ]
    },
    {
        title: "Expert",
        slug: "T4_Expert",
        tier: "T4",
        sections: [
            {
                title: "UVM Methodology Customization",
                slug: "E-CUST-1_UVM_Methodology_Customization",
                topics: [
                    { title: "UVM Methodology Customization", slug: "index", description: "Tailoring UVM to your needs." },
                ]
            },
            {
                title: "Advanced UVM Debug",
                slug: "E-DBG-1_Advanced_UVM_Debug_Methodologies",
                topics: [
                    { title: "Advanced UVM Debug", slug: "index", description: "Techniques for debugging complex UVM environments." },
                ]
            },
            {
                title: "Integrating UVM with Formal Verification",
                slug: "E-INT-1_Integrating_UVM_with_Formal_Verification",
                topics: [
                    { title: "Integrating UVM with Formal Verification", slug: "index", description: "Combining the power of UVM and formal methods." },
                ]
            },
            {
                title: "SoC-Level Verification",
                slug: "E-SOC-1_SoC-Level_Verification_Strategies",
                topics: [
                    { title: "SoC-Level Verification", slug: "index", description: "Strategies for verifying complex SoCs." },
                ]
            },
        ]
    }
];
// Helper functions to navigate the new structure
function findTopicBySlug(slug) {
    if (slug.length !== 3)
        return undefined;
    var tierSlug = slug[0], sectionSlug = slug[1], topicSlug = slug[2];
    var courseModule = exports.curriculumData.find(function (m) { return m.slug === tierSlug; });
    if (!courseModule)
        return undefined;
    var section = courseModule.sections.find(function (s) { return s.slug === sectionSlug; });
    if (!section)
        return undefined;
    return section.topics.find(function (t) { return t.slug === topicSlug; });
}
function getBreadcrumbs(slug) {
    var breadcrumbs = [];
    if (slug.length > 0) {
        var courseModule = exports.curriculumData.find(function (m) { return m.slug === slug[0]; });
        if (courseModule) {
            breadcrumbs.push({ title: courseModule.title, path: "/curriculum/".concat(courseModule.slug) });
            if (slug.length > 1) {
                var section = courseModule.sections.find(function (s) { return s.slug === slug[1]; });
                if (section) {
                    breadcrumbs.push({ title: section.title, path: "/curriculum/".concat(courseModule.slug, "/").concat(section.slug) });
                    if (slug.length > 2) {
                        var topic = section.topics.find(function (t) { return t.slug === slug[2]; });
                        if (topic) {
                            breadcrumbs.push({ title: topic.title, path: "/curriculum/".concat(courseModule.slug, "/").concat(section.slug, "/").concat(topic.slug) });
                        }
                    }
                }
            }
        }
    }
    return breadcrumbs;
}
function findPrevNextTopics(slug) {
    if (slug.length !== 3)
        return { prev: undefined, next: undefined };
    var allTopics = [];
    exports.curriculumData.forEach(function (m) {
        m.sections.forEach(function (s) {
            s.topics.forEach(function (t) {
                allTopics.push(__assign(__assign({}, t), { slug: "".concat(m.slug, "/").concat(s.slug, "/").concat(t.slug) }));
            });
        });
    });
    var currentIndex = allTopics.findIndex(function (t) { return t.slug === slug.join('/'); });
    if (currentIndex === -1)
        return { prev: undefined, next: undefined };
    var prev = currentIndex > 0 ? allTopics[currentIndex - 1] : undefined;
    var next = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : undefined;
    return { prev: prev, next: next };
}
