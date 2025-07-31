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
                title: "SystemVerilog Language Basics",
                slug: "F2_SystemVerilog_Basics",
                topics: [
                    { title: "SystemVerilog Basics", slug: "index", description: "A comprehensive introduction to the fundamental building blocks of the SystemVerilog language." },
                    { title: "Data Types", slug: "F2_Data_Types", description: "Exploring SystemVerilog's data types." },
                    { title: "Procedural Constructs", slug: "F3_Procedural_Constructs", description: "Understanding the building blocks of SystemVerilog code." },
                    { title: "RTL and Testbench Constructs", slug: "F4_RTL_and_Testbench_Constructs", description: "Key constructs for design and verification." }
                ]
            },
            {
                title: "Behavioral & RTL Modeling",
                slug: "F3_Behavioral_RTL_Modeling",
                topics: [
                    { title: "Behavioral & RTL Modeling", slug: "index", description: "A core module that teaches how to describe hardware behavior in SystemVerilog." }
                ]
            },
            {
                title: "Verification Fundamentals",
                slug: "F4_Verification_Basics_without_UVM",
                topics: [
                    { title: "Verification Basics without UVM", slug: "index", description: "Bridging the gap between basic SystemVerilog and the complex UVM methodology." }
                ]
            },
            {
                title: "Object-Oriented Programming for Verification",
                slug: "F5_Intro_to_OOP_in_SV",
                topics: [
                    { title: "Intro to Object-Oriented Programming (OOP) in SV", slug: "index", description: "The final prerequisite before diving into UVM." }
                ]
            }
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
                title: "UVM Introduction",
                slug: "I-UVM-1_UVM_Intro",
                topics: [
                    { title: "UVM Introduction", slug: "index", description: "An introduction to the Universal Verification Methodology." },
                    { title: "UVM Base Classes", slug: "base-classes", description: "uvm_object vs uvm_component." },
                    { title: "Factory", slug: "factory", description: "Factory overrides and creation." },
                    { title: "Phasing", slug: "phasing", description: "UVM phasing mechanism." }
                ]
            },
            {
                title: "Building a UVM Testbench",
                slug: "I-UVM-2_Building_TB",
                topics: [
                    { title: "Building a UVM Testbench", slug: "index", description: "Exploring the foundational classes of UVM." },
                    { title: "Component Communication", slug: "component-communication", description: "TLM ports and analysis ports." },
                    { title: "Architecture Overview", slug: "architecture-overview", description: "Overview of a UVM testbench." },
                    { title: "Agents and Environment", slug: "agents-and-environment", description: "Agent vs environment." }
                ]
            },
            {
                title: "UVM Stimulus Generation",
                slug: "I-UVM-3_Sequences",
                topics: [
                    { title: "Basic UVM Sequences", slug: "index", description: "How UVM components talk to each other." },
                    { title: "Stimulus Generation", slug: "stimulus-generation", description: "Sequences and driver handshake." },
                    { title: "Analysis Components", slug: "analysis-components", description: "Monitors, subscribers, scoreboards." }
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
                title: "UVM Sequences and Virtual Sequences",
                slug: "A1_UVM_Sequences",
                topics: [
                    { title: "UVM Sequences and Virtual Sequences", slug: "A1_UVM_Sequences", description: "In-depth guide to UVM sequence mechanics, layering, and the use of virtual sequences." },
                ]
            },
            {
                title: "Scoreboards and Functional Coverage in UVM",
                slug: "A2_Scoreboards_and_Coverage",
                topics: [
                    { title: "Scoreboards and Functional Coverage in UVM", slug: "A2_Scoreboards_and_Coverage", description: "Explain how to design and implement a UVM scoreboard for automated, self-checking tests." },
                ]
            },
            {
                title: "UVM Configurations and Factory Mastery",
                slug: "A3_Config_and_Factory_Mastery",
                topics: [
                    { title: "UVM Configurations and Factory Mastery", slug: "A3_Config_and_Factory_Mastery", description: "Go beyond the basics of the factory and configuration database to show how they enable highly reusable, polymorphic, and customizable testbenches." },
                ]
            },
            {
                title: "UVM Verification IP Integration",
                slug: "A4_VIP_Integration",
                topics: [
                    { title: "UVM Verification IP Integration", slug: "A4_VIP_Integration", description: "Provide practical guidelines and a conceptual framework for integrating pre-written or third-party Verification IP (VIP) into a custom UVM environment." },
                ]
            },
            {
                title: "Scaling Testbenches and UVM Tips",
                slug: "A5_Scaling_Testbenches",
                topics: [
                    { title: "Scaling Testbenches and UVM Tips", slug: "A5_Scaling_Testbenches", description: "Discuss techniques for managing hundreds of tests, organizing large testbenches, and avoiding common UVM pitfalls that appear at scale." },
                ]
            }
        ]
    },
    {
        title: "Expert",
        slug: "T4_Expert",
        tier: "T4",
        sections: [
            {
                title: "UVM Performance Optimization",
                slug: "E1_UVM_Performance_Optimization",
                topics: [
                    { title: "UVM Performance Optimization", slug: "E1_UVM_Performance_Optimization", description: "Strategies for identifying and fixing performance bottlenecks in UVM." },
                ]
            },
            {
                title: "Customizing UVM",
                slug: "E2_Customizing_UVM",
                topics: [
                    { title: "Customizing UVM", slug: "E2_Customizing_UVM", description: "Extending UVM with custom ports, reports, and callbacks." },
                ]
            },
            {
                title: "Advanced Debugging Techniques",
                slug: "E3_Advanced_Debugging",
                topics: [
                    { title: "Advanced Debugging", slug: "E3_Advanced_Debugging", description: "Expert-level strategies for tackling the most difficult bugs." },
                ]
            },
            {
                title: "UVM Register Layer (RAL)",
                slug: "E4_UVM_Register_Layer",
                topics: [
                    { title: "UVM Register Layer (RAL)", slug: "E4_UVM_Register_Layer", description: "A comprehensive introduction to the UVM Register Abstraction Layer." },
                ]
            },
            {
                title: "Methodology and Best Practices",
                slug: "E5_Methodology_and_Best_Practices",
                topics: [
                    { title: "Methodology and Best Practices", slug: "E5_Methodology_and_Best_Practices", description: "High-level verification strategy and project planning." },
                ]
            }
        ]
    },
    {
        title: "Interactive Tools",
        slug: "interactive-tools",
        tier: "Tools",
        sections: [
            {
                title: "UVM Visualizers",
                slug: "uvm-visualizers",
                topics: [
                    {
                        title: "Interactive UVM Testbench",
                        slug: "interactive-testbench",
                        description: "A hands-on, interactive visualizer for exploring the UVM testbench architecture, phasing, and data flow in real-time."
                    }
                ]
            }
        ]
    }
];
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
            breadcrumbs.push({ title: "Curriculum", path: "/curriculum" });
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
