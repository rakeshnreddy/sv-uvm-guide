export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center text-center min-h-screen p-8">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl font-cal-sans">
          SystemVerilog & UVM Mastery
        </h1>
        <p className="mt-6 text-lg leading-8 text-brand-text-secondary">
          The definitive online platform for mastering SystemVerilog and the Universal Verification Methodology.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="/learn"
            className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Start Learning
          </a>
          <a href="/about" className="text-sm font-semibold leading-6">
            About The Guide <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </main>
  );
}
