import { test, expect } from '@playwright/test';

test.describe('New T3 and T4 Curriculum Modules', () => {

	// T3 tests
	test('T3 Scoreboards and Reference Models loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t3-advanced/a-uvm-6-scoreboards-and-reference-models');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T3 VIP Construction loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t3-advanced/a-uvm-7-vip-construction');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T3 Multi-Agent Topologies loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t3-advanced/a-uvm-8-multi-agent-topologies');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	// T4 tests
	test('T4 Portable Stimulus Standard loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t4-expert/e-pss-1-portable-stimulus-standard');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T4 Python-Based Verification loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t4-expert/e-pyuvm-1-python-based-verification');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T4 AI-Driven Verification loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t4-expert/e-ai-1-ai-driven-verification');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T4 RISC-V Verification Methodology loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t4-expert/e-riscv-1-risc-v-verification-methodology');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T4 Multi-Language Verification loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t4-expert/e-uvm-ml-1-multi-language-verification');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('T4 Emulation-Aware Verification loads correctly', async ({ page }) => {
		await page.goto('/curriculum/t4-expert/e-emu-1-emulation-aware-verification');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});
