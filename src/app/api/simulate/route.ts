import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  let tempDir: string | null = null;
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    // Create a unique temporary directory for this simulation
    tempDir = await fs.mkdtemp(path.join('/tmp', 'verilog-sim-'));

    const filePath = path.join(tempDir, 'design.sv');
    await fs.writeFile(filePath, code);

    const outputFilePath = path.join(tempDir, 'design.vvp');

    // Step 1: Compile the Verilog code
    try {
      await execAsync(`iverilog -o ${outputFilePath} ${filePath}`);
    } catch (error: any) {
      // If compilation fails, return the error message
      return NextResponse.json({
        success: false,
        output: error.stderr || error.stdout || 'Compilation failed with an unknown error.',
        error: 'Compilation Error'
      });
    }

    // Step 2: Run the simulation
    let simulationResult;
    try {
      simulationResult = await execAsync(`vvp ${outputFilePath}`);
    } catch (error: any) {
       // This can happen if there are runtime errors in the simulation
       return NextResponse.json({
        success: false,
        output: error.stderr || error.stdout || 'Simulation failed with a runtime error.',
        error: 'Runtime Error'
      });
    }

    return NextResponse.json({
      success: true,
      output: simulationResult.stdout,
    });

  } catch (error) {
    console.error('Error in /api/simulate:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: 'Failed to process simulation request', details: errorMessage }, { status: 500 });
  } finally {
    // Clean up the temporary directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(`Failed to clean up temporary directory ${tempDir}:`, cleanupError);
      }
    }
  }
}
