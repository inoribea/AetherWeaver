'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ModelConfig {
  type: string;
  config: {
    apiKey: string;
    baseURL?: string;
    model: string;
    temperature: number;
  };
  capabilities: Record<string, boolean>;
  priority: Record<string, number>;
  cost_per_1k_tokens: number;
  speed_rating: number;
  quality_rating: number;
}

interface ModelsConfig {
  models: Record<string, ModelConfig>;
  routing_rules: Record<string, any>;
  selection_strategy: any;
}

export default function ModelsAdminPage() {
  const [config, setConfig] = useState<ModelsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [newModelName, setNewModelName] = useState('');
  const [newModelConfig, setNewModelConfig] = useState<ModelConfig>({
    type: 'openai_compatible',
    config: {
      apiKey: '',
      baseURL: '',
      model: '',
      temperature: 0.7
    },
    capabilities: {
      vision: false,
      reasoning: false,
      tool_calling: false,
      search: false,
      chinese: false,
      structured_output: false,
      agents: false,
      code_generation: false,
      creative_writing: false,
      mathematical_computation: false,
      web_search: false
    },
    priority: {},
    cost_per_1k_tokens: 0.001,
    speed_rating: 5,
    quality_rating: 5
  });

  const capabilityLabels = {
    vision: '视觉处理',
    reasoning: '推理能力',
    tool_calling: '工具调用',
    search: '搜索能力',
    chinese: '中文优化',
    structured_output: '结构化输出',
    agents: '智能代理',
    code_generation: '代码生成',
    creative_writing: '创意写作',
    mathematical_computation: '数学计算',
    web_search: '网络搜索'
  };

  const destinationLabels = {
    vision_processing: '视觉处理',
    complex_reasoning: '复杂推理',
    creative_writing: '创意写作',
    code_generation: '代码生成',
    mathematical_computation: '数学计算',
    web_search: '网络搜索',
    document_retrieval: '文档检索',
    structured_analysis: '结构化分析',
    agent_execution: '智能代理',
    chinese_conversation: '中文对话',
    simple_chat: '简单聊天'
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/models');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      toast.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      const response = await fetch('/api/admin/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        toast.success('配置保存成功');
        // 重新加载路由器
        await fetch('/api/admin/models/reload', { method: 'POST' });
      } else {
        toast.error('配置保存失败');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('配置保存失败');
    }
  };

  const addModel = () => {
    if (!newModelName || !config) return;
    
    const updatedConfig = {
      ...config,
      models: {
        ...config.models,
        [newModelName]: newModelConfig
      }
    };
    
    setConfig(updatedConfig);
    setNewModelName('');
    setNewModelConfig({
      type: 'openai_compatible',
      config: {
        apiKey: '',
        baseURL: '',
        model: '',
        temperature: 0.7
      },
      capabilities: {
        vision: false,
        reasoning: false,
        tool_calling: false,
        search: false,
        chinese: false,
        structured_output: false,
        agents: false,
        code_generation: false,
        creative_writing: false,
        mathematical_computation: false,
        web_search: false
      },
      priority: {},
      cost_per_1k_tokens: 0.001,
      speed_rating: 5,
      quality_rating: 5
    });
    
    toast.success(`模型 ${newModelName} 添加成功`);
  };

  const removeModel = (modelName: string) => {
    if (!config) return;
    
    const updatedModels = { ...config.models };
    delete updatedModels[modelName];
    
    setConfig({
      ...config,
      models: updatedModels
    });
    
    toast.success(`模型 ${modelName} 删除成功`);
  };

  const updateModelCapability = (modelName: string, capability: string, value: boolean) => {
    if (!config) return;
    
    const updatedConfig = {
      ...config,
      models: {
        ...config.models,
        [modelName]: {
          ...config.models[modelName],
          capabilities: {
            ...config.models[modelName].capabilities,
            [capability]: value
          }
        }
      }
    };
    
    setConfig(updatedConfig);
  };

  const updateModelPriority = (modelName: string, destination: string, priority: number) => {
    if (!config) return;
    
    const updatedConfig = {
      ...config,
      models: {
        ...config.models,
        [modelName]: {
          ...config.models[modelName],
          priority: {
            ...config.models[modelName].priority,
            [destination]: priority
          }
        }
      }
    };
    
    setConfig(updatedConfig);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-500">配置加载失败</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">模型管理</h1>
        <Button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-700">
          保存配置
        </Button>
      </div>

      <Tabs defaultValue="models" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="models">模型配置</TabsTrigger>
          <TabsTrigger value="add">添加模型</TabsTrigger>
          <TabsTrigger value="routing">路由规则</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(config.models).map(([modelName, modelConfig]) => (
              <Card key={modelName} className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{modelName}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{modelConfig.type}</Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeModel(modelName)}
                    >
                      删除
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>成本 (每1K tokens)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={modelConfig.cost_per_1k_tokens}
                        onChange={(e) => {
                          const updatedConfig = {
                            ...config,
                            models: {
                              ...config.models,
                              [modelName]: {
                                ...modelConfig,
                                cost_per_1k_tokens: parseFloat(e.target.value)
                              }
                            }
                          };
                          setConfig(updatedConfig);
                        }}
                      />
                    </div>
                    <div>
                      <Label>速度评分 (1-10)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={modelConfig.speed_rating}
                        onChange={(e) => {
                          const updatedConfig = {
                            ...config,
                            models: {
                              ...config.models,
                              [modelName]: {
                                ...modelConfig,
                                speed_rating: parseInt(e.target.value)
                              }
                            }
                          };
                          setConfig(updatedConfig);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold">模型能力</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {Object.entries(modelConfig.capabilities).map(([capability, enabled]) => (
                        <div key={capability} className="flex items-center space-x-2">
                          <Switch
                            id={`${modelName}-${capability}`}
                            checked={enabled}
                            onCheckedChange={(checked) => 
                              updateModelCapability(modelName, capability, checked)
                            }
                          />
                          <Label htmlFor={`${modelName}-${capability}`} className="text-sm">
                            {capabilityLabels[capability as keyof typeof capabilityLabels] || capability}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold">优先级设置</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Object.entries(destinationLabels).map(([destination, label]) => (
                        <div key={destination} className="flex items-center space-x-2">
                          <Label className="text-sm min-w-[120px]">{label}</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={modelConfig.priority[destination] || 5}
                            onChange={(e) => 
                              updateModelPriority(modelName, destination, parseInt(e.target.value))
                            }
                            className="w-20"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>添加新模型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>模型名称</Label>
                  <Input
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="例如: gpt-5-mini"
                  />
                </div>
                <div>
                  <Label>模型类型</Label>
                  <select
                    value={newModelConfig.type}
                    onChange={(e) => setNewModelConfig({
                      ...newModelConfig,
                      type: e.target.value
                    })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="openai_compatible">OpenAI Compatible</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="alibaba_tongyi">Alibaba Tongyi</option>
                    <option value="google_gemini">Google Gemini</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>API Key 环境变量</Label>
                  <Input
                    value={newModelConfig.config.apiKey}
                    onChange={(e) => setNewModelConfig({
                      ...newModelConfig,
                      config: {
                        ...newModelConfig.config,
                        apiKey: e.target.value
                      }
                    })}
                    placeholder="例如: OPENAI_API_KEY"
                  />
                </div>
                <div>
                  <Label>模型ID</Label>
                  <Input
                    value={newModelConfig.config.model}
                    onChange={(e) => setNewModelConfig({
                      ...newModelConfig,
                      config: {
                        ...newModelConfig.config,
                        model: e.target.value
                      }
                    })}
                    placeholder="例如: gpt-5-mini"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>成本 (每1K tokens)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={newModelConfig.cost_per_1k_tokens}
                    onChange={(e) => setNewModelConfig({
                      ...newModelConfig,
                      cost_per_1k_tokens: parseFloat(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label>速度评分 (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={newModelConfig.speed_rating}
                    onChange={(e) => setNewModelConfig({
                      ...newModelConfig,
                      speed_rating: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label>质量评分 (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={newModelConfig.quality_rating}
                    onChange={(e) => setNewModelConfig({
                      ...newModelConfig,
                      quality_rating: parseInt(e.target.value)
                    })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">模型能力</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(newModelConfig.capabilities).map(([capability, enabled]) => (
                    <div key={capability} className="flex items-center space-x-2">
                      <Switch
                        id={`new-${capability}`}
                        checked={enabled}
                        onCheckedChange={(checked) => setNewModelConfig({
                          ...newModelConfig,
                          capabilities: {
                            ...newModelConfig.capabilities,
                            [capability]: checked
                          }
                        })}
                      />
                      <Label htmlFor={`new-${capability}`} className="text-sm">
                        {capabilityLabels[capability as keyof typeof capabilityLabels] || capability}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={addModel} className="w-full">
                添加模型
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>路由规则配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                路由规则基于关键词触发和模型能力匹配，无需手动配置。
                系统会自动根据模型能力和优先级进行智能路由。
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">当前路由目标:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(destinationLabels).map(([destination, label]) => (
                    <Badge key={destination} variant="outline" className="justify-center">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}