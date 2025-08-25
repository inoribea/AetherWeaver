from __future__ import annotations

import os
import json
import time
import random
from typing import Any, Dict, List, Union, Optional
from datetime import datetime

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough

from langflow.custom.custom_component.component import Component
from langflow.io import (
    MessageInput,
    Output,
    DropdownInput,
    BoolInput,
    SliderInput,
    StrInput,
    IntInput
)
from langflow.schema.message import Message

class ModelSelectorComponent(Component, Runnable):
    display_name = "Model Selector (LCEL/LangChain.js Compatible)"
    description = "LCEL-compatible model selector with load balancing, fallback, A/B testing and LangChain.js export"
    icon = "zap"
    name = "ModelSelectorComponent"

    inputs = [
        MessageInput(
            name="routing_input",
            display_name="Routing Input",
            info="Input from conditional router or routing component",
            required=True,
        ),
        DropdownInput(
            name="selection_strategy",
            display_name="Selection Strategy",
            options=["round_robin", "load_balance", "fallback", "a_b_test", "weighted", "fastest"],
            value="round_robin",
            info="Strategy for selecting between multiple models",
            real_time_refresh=True,
        ),
        BoolInput(
            name="enable_model_1",
            display_name="Enable Model 1",
            value=True,
            info="Enable the first model option",
            real_time_refresh=True,
        ),
        DropdownInput(
            name="model_1_provider",
            display_name="Model 1 Provider",
            options=["OpenAI", "Anthropic", "Google", "Deepseek", "OpenAI-Compatible"],
            value="OpenAI",
            info="Provider for model 1",
            real_time_refresh=True,
        ),
        StrInput(
            name="model_1_name",
            display_name="Model 1 Name",
            value="gpt-5-mini",
            info="Name of model 1",
            real_time_refresh=True,
        ),
        SliderInput(
            name="model_1_weight",
            display_name="Model 1 Weight",
            value=0.5,
            range_spec={"min": 0.0, "max": 1.0, "step": 0.1},
            info="Weight for weighted selection (0.0-1.0)",
            advanced=True,
        ),
        BoolInput(
            name="enable_model_2",
            display_name="Enable Model 2",
            value=True,
            info="Enable the second model option",
            real_time_refresh=True,
        ),
        DropdownInput(
            name="model_2_provider",
            display_name="Model 2 Provider",
            options=["OpenAI", "Anthropic", "Google", "Deepseek", "OpenAI-Compatible"],
            value="Anthropic",
            info="Provider for model 2",
            real_time_refresh=True,
        ),
        StrInput(
            name="model_2_name",
            display_name="Model 2 Name",
            value="claude-3-haiku-20240307",
            info="Name of model 2",
            real_time_refresh=True,
        ),
        SliderInput(
            name="model_2_weight",
            display_name="Model 2 Weight",
            value=0.5,
            range_spec={"min": 0.0, "max": 1.0, "step": 0.1},
            info="Weight for weighted selection (0.0-1.0)",
            advanced=True,
        ),
        BoolInput(
            name="enable_model_3",
            display_name="Enable Model 3",
            value=False,
            info="Enable the third model option",
            real_time_refresh=True,
        ),
        DropdownInput(
            name="model_3_provider",
            display_name="Model 3 Provider",
            options=["OpenAI", "Anthropic", "Google", "DeepSeek", "OpenAI-Compatible"],
            value="Google",
            info="Provider for model 3",
            real_time_refresh=True,
        ),
        StrInput(
            name="model_3_name",
            display_name="Model 3 Name",
            value="gemini-1.5-flash",
            info="Name of model 3",
            real_time_refresh=True,
        ),
        SliderInput(
            name="model_3_weight",
            display_name="Model 3 Weight",
            value=0.0,
            range_spec={"min": 0.0, "max": 1.0, "step": 0.1},
            info="Weight for weighted selection (0.0-1.0)",
            advanced=True,
        ),
        # LangChain.js兼容性设置
        BoolInput(
            name="langchainjs_export",
            display_name="LangChain.js Export Mode",
            value=False,
            info="Enable LangChain.js compatible configuration and export",
            advanced=True,
        ),
        BoolInput(
            name="vercel_mode",
            display_name="Vercel Environment Mode",
            value=False,
            info="Enable Vercel environment variable support for deployment",
            advanced=True,
        ),
        BoolInput(
            name="enable_runnable_interface",
            display_name="Enable Runnable Interface",
            value=True,
            info="Make component fully LCEL Runnable compatible",
            advanced=True,
        ),
        BoolInput(
            name="flatten_metadata",
            display_name="Flatten Metadata",
            value=True,
            info="Use flattened metadata structure for LCEL compatibility",
            advanced=True,
        ),
        # 高级选项
        IntInput(
            name="ab_test_ratio",
            display_name="A/B Test Ratio (%)",
            value=50,
            info="Percentage for A/B testing (0-100)",
            advanced=True,
        ),
        IntInput(
            name="fallback_timeout_ms",
            display_name="Fallback Timeout (ms)",
            value=5000,
            info="Timeout before switching to fallback model",
            advanced=True,
        ),
        BoolInput(
            name="enable_performance_tracking",
            display_name="Enable Performance Tracking",
            value=True,
            info="Track model performance for load balancing",
            advanced=True,
        ),
    ]
    
    outputs = [
        Output(
            display_name="Selected Model Config",
            name="selected_model_config",
            method="get_selected_model_config",
        ),
    ]
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.selection_history = []
        self.performance_stats = {}
        self.current_round_robin_index = 0
    
    def _load_environment_config(self) -> Dict[str, Any]:
        """加载环境变量配置，支持Vercel模式"""
        
        default_config = {
            "selection_strategies": {
                "round_robin": {"rotate_on_request": True},
                "load_balance": {"consider_response_time": True, "consider_error_rate": True},
                "fallback": {"primary_first": True, "cascade_on_failure": True},
                "a_b_test": {"persist_user_assignment": False},
                "weighted": {"normalize_weights": True},
                "fastest": {"track_response_times": True, "sample_size": 10}
            },
            "performance_tracking": {
                "enabled": self.enable_performance_tracking,
                "track_response_time": True,
                "track_error_rate": True,
                "track_token_usage": True,
                "window_size": 100
            },
            "langchainjs_compatibility": {
                "export_format": self.langchainjs_export,
                "flatten_metadata": self.flatten_metadata,
                "runnable_interface": self.enable_runnable_interface,
                "model_field_mapping": {
                    "OpenAI": {"provider": "openai", "field": "model"},
                    "Anthropic": {"provider": "anthropic", "field": "model"},
                    "Google": {"provider": "google", "field": "model"},
                    "deepSeek": {"provider": "deepseek", "field": "model"},
                    "OpenAI-Compatible": {"provider": "openai-compatible", "field": "model"}
                }
            }
        }
        
        try:
            if self.vercel_mode:
                config_str = os.getenv("LANGFLOW_MODEL_SELECTOR_CONFIG", "{}")
                vercel_config = json.loads(config_str) if config_str else {}
                default_config.update(vercel_config)
            else:
                config_str = os.getenv("MODEL_SELECTOR_CONFIG", "{}")
                env_config = json.loads(config_str) if config_str else {}
                default_config.update(env_config)
                
        except (json.JSONDecodeError, TypeError):
            pass
            
        return default_config
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """获取可用的模型列表"""
        models = []
        
        if self.enable_model_1:
            models.append({
                "id": "model_1",
                "provider": self.model_1_provider,
                "name": self.model_1_name,
                "weight": self.model_1_weight,
                "enabled": True
            })
        
        if self.enable_model_2:
            models.append({
                "id": "model_2", 
                "provider": self.model_2_provider,
                "name": self.model_2_name,
                "weight": self.model_2_weight,
                "enabled": True
            })
        
        if self.enable_model_3:
            models.append({
                "id": "model_3",
                "provider": self.model_3_provider,
                "name": self.model_3_name,
                "weight": self.model_3_weight,
                "enabled": True
            })
        
        return models
    
    def select_model_by_round_robin(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """轮询选择模型"""
        if not models:
            raise ValueError("No models available")
        
        selected_model = models[self.current_round_robin_index % len(models)]
        self.current_round_robin_index += 1
        
        return selected_model
    
    def select_model_by_weighted(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """按权重选择模型"""
        if not models:
            raise ValueError("No models available") 
        
        # 计算总权重
        total_weight = sum(model["weight"] for model in models)
        if total_weight == 0:
            return random.choice(models)
        
        # 权重随机选择
        random_value = random.random() * total_weight
        current_weight = 0
        
        for model in models:
            current_weight += model["weight"]
            if random_value <= current_weight:
                return model
        
        return models[-1]  # 降级到最后一个模型
    
    def select_model_by_load_balance(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """按负载均衡选择模型"""
        if not models:
            raise ValueError("No models available")
        
        if not self.enable_performance_tracking:
            return self.select_model_by_round_robin(models)
        
        # 基于性能统计选择最佳模型
        best_model = models[0]
        best_score = float('inf')
        
        for model in models:
            model_id = model["id"]
            stats = self.performance_stats.get(model_id, {
                "avg_response_time": 1000,
                "error_rate": 0.0,
                "request_count": 0
            })
            
            # 计算负载分数（响应时间 + 错误率权重）
            score = stats["avg_response_time"] + (stats["error_rate"] * 2000)
            
            if score < best_score:
                best_score = score
                best_model = model
        
        return best_model
    
    def select_model_by_fallback(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """按降级策略选择模型"""
        if not models:
            raise ValueError("No models available")
        
        # 按顺序返回第一个可用模型
        return models[0]
    
    def select_model_by_ab_test(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """A/B测试选择模型"""
        if len(models) < 2:
            return models[0] if models else None
        
        # 基于A/B测试比例选择
        if random.randint(1, 100) <= self.ab_test_ratio:
            return models[0]  # A组
        else:
            return models[1]  # B组
    
    def select_model_by_fastest(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """选择最快的模型"""
        if not models:
            raise ValueError("No models available")
        
        if not self.enable_performance_tracking:
            return self.select_model_by_round_robin(models)
        
        # 选择平均响应时间最短的模型
        fastest_model = models[0]
        fastest_time = float('inf')
        
        for model in models:
            model_id = model["id"]
            stats = self.performance_stats.get(model_id, {"avg_response_time": 1000})
            
            if stats["avg_response_time"] < fastest_time:
                fastest_time = stats["avg_response_time"]
                fastest_model = model
        
        return fastest_model
    
    def select_model(self, models: List[Dict[str, Any]]) -> Dict[str, Any]:
        """根据策略选择模型"""
        
        if not models:
            raise ValueError("No models available for selection")
        
        if self.selection_strategy == "round_robin":
            return self.select_model_by_round_robin(models)
        elif self.selection_strategy == "weighted":
            return self.select_model_by_weighted(models)
        elif self.selection_strategy == "load_balance":
            return self.select_model_by_load_balance(models)
        elif self.selection_strategy == "fallback":
            return self.select_model_by_fallback(models)
        elif self.selection_strategy == "a_b_test":
            return self.select_model_by_ab_test(models)
        elif self.selection_strategy == "fastest":
            return self.select_model_by_fastest(models)
        else:
            return self.select_model_by_round_robin(models)
    
    def update_performance_stats(self, model_id: str, response_time: float, 
                                success: bool = True):
        """更新性能统计"""
        if not self.enable_performance_tracking:
            return
        
        if model_id not in self.performance_stats:
            self.performance_stats[model_id] = {
                "avg_response_time": response_time,
                "error_rate": 0.0,
                "request_count": 1,
                "total_response_time": response_time,
                "error_count": 0 if success else 1
            }
        else:
            stats = self.performance_stats[model_id]
            stats["request_count"] += 1
            stats["total_response_time"] += response_time
            stats["avg_response_time"] = stats["total_response_time"] / stats["request_count"]
            
            if not success:
                stats["error_count"] += 1
            
            stats["error_rate"] = stats["error_count"] / stats["request_count"]
    
    # LCEL Runnable接口实现
    def invoke(self, input_data: Any, config: Optional[Dict] = None) -> Message:
        """LCEL Runnable.invoke方法实现"""
        original_input = getattr(self, 'routing_input', None)
        self.routing_input = input_data if isinstance(input_data, Message) else Message(text=str(input_data))
        
        try:
            result = self.get_selected_model_config()
            return result
        finally:
            self.routing_input = original_input
    
    async def ainvoke(self, input_data: Any, config: Optional[Dict] = None) -> Message:
        """LCEL Runnable.ainvoke异步方法实现"""
        return self.invoke(input_data, config)
    
    def stream(self, input_data: Any, config: Optional[Dict] = None):
        """LCEL Runnable.stream方法实现"""
        result = self.invoke(input_data, config)
        yield result
    
    async def astream(self, input_data: Any, config: Optional[Dict] = None):
        """LCEL Runnable.astream异步流方法实现"""
        result = await self.ainvoke(input_data, config)
        yield result
    
    def batch(self, inputs: List[Any], config: Optional[Dict] = None) -> List[Message]:
        """LCEL Runnable.batch方法实现"""
        return [self.invoke(input_data, config) for input_data in inputs]
    
    async def abatch(self, inputs: List[Any], config: Optional[Dict] = None) -> List[Message]:
        """LCEL Runnable.abatch异步批处理方法实现"""
        return [await self.ainvoke(input_data, config) for input_data in inputs]
    
    def get_selected_model_config(self) -> Message:
        """获取选中的模型配置"""
        
        start_time = time.time()
        
        try:
            # 加载环境配置
            env_config = self._load_environment_config()
            
            # 获取可用模型
            available_models = self.get_available_models()
            
            if not available_models:
                raise ValueError("No models are enabled")
            
            # 选择模型
            selected_model = self.select_model(available_models)
            
            selection_time = int((time.time() - start_time) * 1000)
            
            # 记录选择历史
            self.selection_history.append({
                "timestamp": datetime.now().isoformat(),
                "selected_model": selected_model["id"],
                "strategy": self.selection_strategy,
                "available_count": len(available_models)
            })
            
            # 构建输出配置
            model_config = self._create_model_config(selected_model, env_config, selection_time)
            
            # 构建metadata
            metadata = self._create_selection_metadata(
                selected_model, available_models, selection_time, env_config
            )
            
            # 状态指示器
            strategy_indicator = {
                "round_robin": "🔄",
                "weighted": "⚖️", 
                "load_balance": "⚡",
                "fallback": "🔄",
                "a_b_test": "🎯",
                "fastest": "🚀"
            }.get(self.selection_strategy, "❓")
            
            model_indicator = f"{selected_model['provider'][:1]}{selected_model['name'][-4:]}"
            
            self.status = f"✅ {strategy_indicator} {model_indicator} | {selection_time}ms | {len(available_models)} models"
            
            return Message(text=json.dumps(model_config, indent=2), metadata=metadata)
            
        except Exception as e:
            error_time = int((time.time() - start_time) * 1000)
            self.status = f"❌ Selection failed: {str(e)[:30]}... | {error_time}ms"
            
            # 返回降级配置
            fallback_config = {
                "provider": "OpenAI",
                "model": "gpt-4.1",
                "selection_strategy": "fallback",
                "error": str(e)
            }
            
            return Message(
                text=json.dumps(fallback_config, indent=2),
                metadata={
                    "error": str(e),
                    "execution_time_ms": error_time,
                    "component_source": "ModelSelectorComponent",
                    "fallback_mode": True
                }
            )
    
    def _create_model_config(self, selected_model: Dict[str, Any], 
                            env_config: Dict[str, Any], selection_time: int) -> Dict[str, Any]:
        """创建模型配置"""
        
        base_config = {
            "provider": selected_model["provider"],
            "model": selected_model["name"],
            "model_id": selected_model["id"],
            "selection_strategy": self.selection_strategy,
            "selection_time_ms": selection_time,
            "weight": selected_model["weight"]
        }
        
        if self.langchainjs_export:
            # LangChain.js兼容格式
            provider_mapping = env_config.get("langchainjs_compatibility", {}).get("model_field_mapping", {})
            provider_info = provider_mapping.get(selected_model["provider"], {})
            
            base_config.update({
                "langchainjs_provider": provider_info.get("provider", selected_model["provider"].lower()),
                "langchainjs_field": provider_info.get("field", "model"),
                "langchainjs_ready": True,
                "export_format": "langchainjs"
            })
        
        return base_config
    
    def _create_selection_metadata(self, selected_model: Dict[str, Any], 
                                  available_models: List[Dict[str, Any]], 
                                  selection_time: int, env_config: Dict[str, Any]) -> Dict[str, Any]:
        """创建选择metadata"""
        
        if self.langchainjs_export:
            # LangChain.js兼容格式（扁平化）
            return {
                "type": "model_selection",
                "source": "langflow",
                "component": "ModelSelectorComponent",
                "timestamp": datetime.now().isoformat(),
                
                "selected_model_id": selected_model["id"],
                "selected_provider": selected_model["provider"],
                "selected_model_name": selected_model["name"],
                "selection_strategy": self.selection_strategy,
                "selection_time_ms": selection_time,
                
                "available_models_count": len(available_models),
                "total_selections": len(self.selection_history),
                
                "langchainjs_ready": True,
                "runnable_interface": self.enable_runnable_interface,
                "vercel_mode": self.vercel_mode,
                "flatten_metadata": self.flatten_metadata,
                
                "performance_tracking": self.enable_performance_tracking,
                "ab_test_ratio": self.ab_test_ratio if self.selection_strategy == "a_b_test" else None
            }
        elif self.flatten_metadata:
            # 扁平化格式
            return {
                "selected_model_id": selected_model["id"],
                "selected_provider": selected_model["provider"],
                "selected_model_name": selected_model["name"],
                "selection_strategy": self.selection_strategy,
                "selection_time_ms": selection_time,
                "available_models_count": len(available_models),
                "component_source": "ModelSelectorComponent",
                "lcel_compatible": True,
                "runnable_interface": self.enable_runnable_interface
            }
        else:
            # 嵌套格式
            return {
                "selection_info": {
                    "selected_model": selected_model,
                    "strategy": self.selection_strategy,
                    "time_ms": selection_time,
                    "available_models": available_models
                },
                "performance_info": {
                    "tracking_enabled": self.enable_performance_tracking,
                    "stats": self.performance_stats,
                    "selection_history_count": len(self.selection_history)
                },
                "component_source": "ModelSelectorComponent",
                "lcel_compatible": True,
                "runnable_interface": self.enable_runnable_interface
            }
    
    def export_to_vercel_config(self) -> Dict[str, Any]:
        """导出Vercel兼容配置"""
        
        available_models = self.get_available_models()
        
        config = {
            "component_type": "model_selector",
            "selection_strategy": self.selection_strategy,
            "models": [
                {
                    "id": model["id"],
                    "provider": model["provider"].lower(),
                    "model": model["name"],
                    "weight": model["weight"],
                    "enabled": model["enabled"]
                }
                for model in available_models
            ],
            "config": {
                "ab_test_ratio": self.ab_test_ratio,
                "fallback_timeout_ms": self.fallback_timeout_ms,
                "performance_tracking": self.enable_performance_tracking
            },
            "langchainjs_compatible": self.langchainjs_export,
            "vercel_ready": True
        }
        
        return config
    
    def update_build_config(self, build_config: dict, field_value: Any, field_name: str | None = None) -> dict:
        """动态更新配置"""
        
        if field_name == "enable_model_1":
            build_config["model_1_provider"]["show"] = field_value
            build_config["model_1_name"]["show"] = field_value
            build_config["model_1_weight"]["show"] = field_value and self.selection_strategy == "weighted"
            
        elif field_name == "enable_model_2":
            build_config["model_2_provider"]["show"] = field_value
            build_config["model_2_name"]["show"] = field_value
            build_config["model_2_weight"]["show"] = field_value and self.selection_strategy == "weighted"
            
        elif field_name == "enable_model_3":
            build_config["model_3_provider"]["show"] = field_value
            build_config["model_3_name"]["show"] = field_value
            build_config["model_3_weight"]["show"] = field_value and self.selection_strategy == "weighted"
            
        elif field_name == "selection_strategy":
            show_weights = field_value == "weighted"
            show_ab_test = field_value == "a_b_test"
            show_performance = field_value in ["load_balance", "fastest"]
            
            build_config["model_1_weight"]["show"] = show_weights and self.enable_model_1
            build_config["model_2_weight"]["show"] = show_weights and self.enable_model_2
            build_config["model_3_weight"]["show"] = show_weights and self.enable_model_3
            build_config["ab_test_ratio"]["show"] = show_ab_test
            build_config["enable_performance_tracking"]["show"] = show_performance
            
        elif field_name == "langchainjs_export":
            if field_value:
                build_config["enable_runnable_interface"]["show"] = True
                build_config["flatten_metadata"]["show"] = True
                build_config["vercel_mode"]["show"] = True
            else:
                build_config["enable_runnable_interface"]["show"] = False
                
        return build_config
    
    # LCEL Chain组合方法
    def pipe(self, *others):
        """LCEL pipe操作符支持"""
        from langchain_core.runnables import RunnableSequence
        return RunnableSequence(first=self, middle=[], last=others[0] if others else RunnablePassthrough())
    
    def __or__(self, other):
        """LCEL | 操作符支持"""
        return self.pipe(other)
        
    def __ror__(self, other):
        """LCEL | 操作符支持（反向）"""
        if hasattr(other, 'pipe'):
            return other.pipe(self)
        from langchain_core.runnables import RunnableSequence
        return RunnableSequence(first=other, middle=[], last=self)
    
    @property
    def config_specs(self):
        """LCEL配置规范"""
        return {
            "runnable_type": "model_selector",
            "supports_streaming": True,
            "supports_async": True,
            "supports_batching": True,
            "memory_compatible": False,
            "langchainjs_exportable": True
        }
