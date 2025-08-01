export interface LCELMessage {
  text: string;
  metadata?: Record<string, any>;
}

export interface LCELComponent {
  invoke(input: any, config?: Record<string, any>): Promise<LCELMessage>;
  ainvoke(input: any, config?: Record<string, any>): Promise<LCELMessage>;
  stream(input: any, config?: Record<string, any>): AsyncGenerator<LCELMessage>;
  astream(input: any, config?: Record<string, any>): AsyncGenerator<LCELMessage>;
  batch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]>;
  abatch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]>;
}