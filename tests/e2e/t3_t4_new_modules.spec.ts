import { test, expect, type Page } from '@playwright/test';

test.describe('New T3 and T4 Curriculum Modules', () => {
	const expectLesson = async (page: Page, href: string, title: string) => {
		const response = await page.goto(href, { waitUntil: 'domcontentloaded' });
		expect(response, `${href} should return a response`).not.toBeNull();
		expect(response!.status(), `${href} should return < 400`).toBeLessThan(400);
		await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(title);
	};

	// T3 tests
	test('T3 Scoreboards and Reference Models loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index', 'A-UVM-6: Scoreboards and Reference Models');
	});

	test('T3 VIP Construction loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T3_Advanced/A-UVM-7_VIP_Construction/index', 'A-UVM-7: VIP Construction');
	});

	test('T3 Multi-Agent Topologies loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T3_Advanced/A-UVM-8_Multi_Agent_Topologies/index', 'A-UVM-8: Multi-Agent Topologies');
	});

	// T4 tests
	test('T4 Portable Stimulus Standard loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index', 'E-PSS-1: Portable Stimulus Standard');
	});

	test('T4 Python-Based Verification loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T4_Expert/E-PYUVM-1_Python_Based_Verification/index', 'E-PYUVM-1: Python-Based Verification');
	});

	test('T4 AI-Driven Verification loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T4_Expert/E-AI-1_AI_Driven_Verification/index', 'E-AI-1: AI-Driven Verification');
	});

	test('T4 RISC-V Verification Methodology loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T4_Expert/E-RISCV-1_RISC_V_Verification_Methodology/index', 'E-RISCV-1: RISC-V Verification Methodology');
	});

	test('T4 Multi-Language Verification loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T4_Expert/E-UVM-ML-1_Multi_Language_Verification/index', 'E-UVM-ML-1: Multi-Language Verification');
	});

	test('T4 Emulation-Aware Verification loads correctly', async ({ page }) => {
		await expectLesson(page, '/curriculum/T4_Expert/E-EMU-1_Emulation_Aware_Verification/index', 'E-EMU-1: Emulation-Aware Verification');
	});
});
