declare namespace vi {
  interface Mock {
    mockResolvedValue: (...args: any[]) => any;
    mockImplementation: (...args: any[]) => any;
  }
}
