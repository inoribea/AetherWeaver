    import time
    import os
    import json
    from typing import Any, Dict, Optional
    
    from langchain_anthropic import ChatAnthropic
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_openai import ChatOpenAI
    from langchain_core.runnables import Runnable
    from langchain_core.messages import SystemMessage, HumanMessage
    
    from langflow.base.models.anthropic_constants import ANTHROPIC_MODELS
    from langflow.base.models.google_generative_ai_constants import GOOGLE_GENERATIVE_AI_MODELS
    from langflow.base.models.model import LCModelComponent
    from langflow.base.models.openai_constants import OPENAI_CHAT_MODEL_NAMES
    from langflow.field_typing import LanguageModel
    from langflow.field_typing.range_spec import RangeSpec
    from langflow.inputs.inputs import BoolInput
    from langflow.io import DropdownInput, MessageInput, SecretStrInput, SliderInput, StrInput
    from langflow.schema.dotdict import dotdict
    
    class RoutingDecisionModelComponent(LCModelComponent):
        display_name = "Routing Decision Model (LCEL/LangChain.js Compatible)"
        description = "专门用于智能路由决策的轻量级模型组件，支持LCEL、LangChain.js导出和Vercel部署"
        documentation: str = "https://docs.langflow.org/components-models"
        icon = "route"
        category = "models"
        priority = 1
        lcel_compatible = True
        supports_langserve = True
    
        inputs = [
            DropdownInput(
                name="provider",
                display_name="Model Provider",
                options=["OpenAI", "Anthropic", "Google", "OpenAI-Compatible"],
                value="OpenAI",
                info="Select the model provider",
                real_time_refresh=True,
                options_metadata=[{"icon": "OpenAI"}, {"icon": "Anthropic"}, {"icon": "GoogleGenerativeAI"}, {"icon": "Settings"}],
            ),
            BoolInput(
                name="use_custom_model",
                display_name="Use Custom Model",
                value=False,
                info="Enable to use custom model name instead of predefined list",
                real_time_refresh=True,
                advanced=False,
            ),
            # 新增兼容性开关
            BoolInput(
                name="vercel_mode",
                display_name="Vercel Environment Mode",
                value=False,
                info="Enable Vercel environment variable support for deployment",
                advanced=True,
            ),
            BoolInput(
                name="langchainjs_export",
                display_name="LangChain.js Export Mode",
                value=False,
                info="Enable LangChain.js compatible configuration and export",
                advanced=True,
            ),
            BoolInput(
                name="enable_json_mode",
                display_name="Enable JSON Mode",
                value=True,
                info="Force JSON output for routing decisions",
                advanced=False,
            ),
            BoolInput(
                name="enable_runnable_interface",
                display_name="Enable Runnable Interface",
                value=True,
                info="Make component fully LCEL Runnable compatible",
                advanced=True,
            ),
            DropdownInput(
                name="model_name",
                display_name="Model Name",
                options=OPENAI_CHAT_MODEL_NAMES,
                value="gpt-4o-mini",
                info="Select the model to use from predefined list",
                real_time_refresh=True,
                show=True,
            ),
            StrInput(
                name="custom_model_name",
                display_name="Custom Model Name",
                info="Enter custom model name",
                show=False,
                advanced=False,
                placeholder="gpt-4o, claude-3-5-sonnet-20241022, gemini-pro, etc.",
            ),
            BoolInput(
                name="use_custom_url",
                display_name="Use Custom Base URL",
                value=False,
                info="Enable to use custom API endpoint URL",
                real_time_refresh=True,
                advanced=True,
            ),
            StrInput(
                name="base_url",
                display_name="Custom Base URL",
                info="Custom API endpoint URL",
                placeholder="https://api.example.com/v1",
                show=True,
                advanced=True,
            ),
            SecretStrInput(
                name="api_key",
                display_name="API Key",
                info="Model Provider API key (supports Vercel env vars)",
                required=True,
                show=True,
            ),
            
            MessageInput(
                name="input_value",
                display_name="User Input",
                info="The user input to analyze for routing",
            ),
            
            # 路由决策专用参数
            SliderInput(
                name="temperature",
                display_name="Temperature",
                value=0.1,  # 路由决策需要确定性
                info="Controls randomness in routing decisions (keep low for consistency)",
                range_spec=RangeSpec(min=0, max=0.3, step=0.01),
                advanced=False,
            ),
            
            SliderInput(
                name="max_tokens",
                display_name="Max Tokens",
                value=300,  # 路由决策不需要太多token
                info="Maximum tokens for routing analysis",
                range_spec=RangeSpec(min=50, max=500, step=10),
                advanced=True,
            ),
        ]
    
        def _load_environment_config(self) -> Dict[str, Any]:
            """加载环境变量配置，支持Vercel模式"""
            
            default_config = {
                "routing_prompts": {
                    "system_template": "default",
                    "include_examples": True,
                    "language_detection": True,
                    "memory_support": True
                },
                "model_fallbacks": {
                    "primary": self.get_effective_model_name(),
                    "secondary": "gpt-4o-mini"
                },
                "response_format": {
                    "force_json": self.enable_json_mode,
                    "langchainjs_compatible": self.langchainjs_export,
                    "runnable_interface": self.enable_runnable_interface
                },
                "lcel_configuration": {
                    "enable_streaming": True,
                    "enable_async": True,
                    "enable_batching": True,
                    "enable_parallel": True
                }
            }
            
            try:
                if self.vercel_mode:
                    # Vercel环境变量
                    config_str = os.getenv("LANGFLOW_ROUTING_MODEL_CONFIG", "{}")
                    vercel_config = json.loads(config_str) if config_str else {}
                    default_config.update(vercel_config)
                    
                    # Vercel特定设置
                    default_config["deployment_env"] = "vercel"
                    default_config["edge_compatible"] = True
                    default_config["region"] = os.getenv("VERCEL_REGION", "unknown")
                    
                else:
                    # 标准环境变量
                    config_str = os.getenv("ROUTING_MODEL_CONFIG", "{}")
                    env_config = json.loads(config_str) if config_str else {}
                    default_config.update(env_config)
                    
            except (json.JSONDecodeError, TypeError):
                pass
                
            return default_config
    
        def get_routing_system_message(self) -> str:
            """专门用于路由决策的系统提示词，支持环境配置和记忆"""
            
            env_config = self._load_environment_config()
            
            if env_config.get("routing_prompts", {}).get("system_template") == "custom":
                return env_config.get("custom_system_prompt", self._get_default_system_prompt())
            
            return self._get_default_system_prompt()
    
        def _get_default_system_prompt(self) -> str:
            """默认系统提示词，支持记忆和LCEL兼容性"""
            
            base_prompt = """你是一个专业的智能路由分析助手。你的任务是分析用户输入（可能包含对话历史）并决定最适合的处理模式。
    
    **重要原则：**
    1. 检测用户输入的语言，并在后续所有回复中使用相同语言
    2. 如果用户使用中文，你必须用中文分析和回复
    3. 如果用户使用英文，你必须用英文分析和回复
    4. 考虑对话历史上下文，判断是否为对话延续
    
    **路由决策标准：**
    
    **basic模式** - 适用于：
    - 简单问候、闲聊
    - 基础问答
    - 需要简洁回复的问题
    - 一般性咨询
    
    **enhanced模式** - 适用于：  
    - 复杂分析需求
    - 需要深度思考的问题
    - 多角度分析
    - 专业建议和解决方案
    - 创作任务（如写诗、文章等）
    - 对话历史中显示的复杂任务延续
    
    **rag模式** - 适用于：
    - 需要查询特定知识库
    - 引用具体信息源
    - 基于文档的问答
    - 需要搜索历史记录
    - 明确的信息检索需求
    
    **agent模式** - 适用于：
    - 需要使用工具
    - 多步骤任务执行
    - 需要外部API调用
    - 计算和数据处理
    - 工具链操作"""
    
            if self.enable_json_mode or self.langchainjs_export:
                base_prompt += """
    
    **分析格式要求：**
    请以JSON格式回复，确保LCEL和LangChain.js兼容：
    {
      "language": "zh/en",
      "routing_decision": "basic/enhanced/rag/agent",
      "confidence": 0.8,
      "reasoning": "简要说明选择理由",
      "detected_intent": "用户意图描述",
      "has_memory_context": "true/false",
      "memory_relevance": "低/中/高",
      "langchainjs_compatible": true,
      "lcel_runnable": true
    }"""
            else:
                base_prompt += """
    
    **分析格式要求：**
    请以JSON格式回复：
    {
      "language": "zh/en", 
      "routing_decision": "basic/enhanced/rag/agent",
      "confidence": 0.8,
      "reasoning": "简要说明选择理由",
      "detected_intent": "用户意图描述",
      "has_memory_context": "true/false"
    }"""
    
            base_prompt += "\n\n请立即分析用户输入并给出路由决策。"
            
            return base_prompt
    
        def get_effective_model_name(self) -> str:
            """获取实际使用的模型名称"""
            return self.custom_model_name if self.use_custom_model else self.model_name
    
        def build_model(self) -> LanguageModel:
            """构建模型，支持LCEL Runnable接口和LangChain.js兼容性"""
            
            env_config = self._load_environment_config()
            provider = self.provider
            model_name = self.get_effective_model_name()
            temperature = self.temperature
            max_tokens = self.max_tokens
    
            # 从环境变量获取API密钥（支持Vercel模式）
            api_key = self.api_key
            if not api_key and self.vercel_mode:
                if provider == "OpenAI":
                    api_key = os.getenv("OPENAI_API_KEY")
                elif provider == "Anthropic":
                    api_key = os.getenv("ANTHROPIC_API_KEY")
                elif provider == "Google":
                    api_key = os.getenv("GOOGLE_API_KEY")
    
            # LCEL兼容性配置
            lcel_config = env_config.get("lcel_configuration", {})
            
            if provider == "OpenAI":
                if not api_key:
                    msg = "OpenAI API key is required"
                    raise ValueError(msg)
    
                openai_kwargs = {
                    "model": model_name,  # 使用model而不是model_name，兼容LangChain.js
                    "temperature": temperature,
                    "streaming": lcel_config.get("enable_streaming", True),
                    "openai_api_key": api_key,
                    "max_tokens": max_tokens,
                }
                
                # LangChain.js兼容性设置
                if self.langchainjs_export and self.enable_json_mode:
                    openai_kwargs["response_format"] = {"type": "json_object"}
                
                # 自定义URL支持
                if self.use_custom_url and self.base_url:
                    openai_kwargs["base_url"] = self.base_url
                
                model = ChatOpenAI(**openai_kwargs)
                
            elif provider == "Anthropic":
                if not api_key:
                    msg = "Anthropic API key is required"
                    raise ValueError(msg)
                
                anthropic_kwargs = {
                    "model": model_name,
                    "temperature": temperature,
                    "streaming": lcel_config.get("enable_streaming", True),
                    "anthropic_api_key": api_key,
                    "max_tokens": max_tokens,
                }
                
                model = ChatAnthropic(**anthropic_kwargs)
            
            elif provider == "Google":
                if not api_key:
                    msg = "Google API key is required"
                    raise ValueError(msg)
                    
                google_kwargs = {
                    "model": model_name,
                    "temperature": temperature,
                    "streaming": lcel_config.get("enable_streaming", True),
                    "google_api_key": api_key,
                    "max_tokens": max_tokens,
                }
                
                model = ChatGoogleGenerativeAI(**google_kwargs)
            
            else:
                msg = f"Unknown provider: {provider}"
                raise ValueError(msg)
            
            # 确保模型符合LCEL Runnable接口 [2][5]
            if self.enable_runnable_interface and not isinstance(model, Runnable):
                from langchain_core.runnables import RunnableLambda
                model = RunnableLambda(lambda x: model.invoke(x))
            
            return model
    
        def _build_message(self) -> Any:
            """构建路由决策消息，支持记忆和LCEL格式"""
            
            # 构建专门的路由分析消息
            system_message = self.get_routing_system_message()
            
            # 处理用户输入，可能包含记忆信息
            if hasattr(self.input_value, 'text'):
                user_input = str(self.input_value.text)
            else:
                user_input = str(self.input_value)
            
            # 检查是否包含对话历史（来自记忆组件）
            analysis_prompt = f"请分析以下用户输入并给出路由决策：\n\n{user_input}"
            
            # 检查是否包含对话历史标记
            if any(marker in user_input for marker in ['Human:', 'Assistant:', 'User:', 'AI:']):
                analysis_prompt = f"请基于以下对话历史和当前用户输入给出路由决策：\n\n{user_input}"
            
            messages = [
                SystemMessage(content=system_message),
                HumanMessage(content=analysis_prompt)
            ]
            
            return messages
    
        def update_build_config(self, build_config: dotdict, field_value: Any, field_name: str | None = None) -> dotdict:
            """动态配置更新，支持LCEL和LangChain.js模式"""
            if field_name == "provider":
                if field_value == "OpenAI":
                    build_config["model_name"]["options"] = ["gpt-4o-mini", "gpt-4.1", "gpt-4o"]
                    build_config["model_name"]["value"] = "gpt-4o-mini"
                    build_config["api_key"]["display_name"] = "OpenAI API Key"
                    
                elif field_value == "Anthropic":
                    build_config["model_name"]["options"] = ["claude-3-haiku-20240307", "claude-3-sonnet-20240229"]
                    build_config["model_name"]["value"] = "claude-3-haiku-20240307"
                    build_config["api_key"]["display_name"] = "Anthropic API Key"
                    
                elif field_value == "Google":
                    build_config["model_name"]["options"] = ["gemini-1.5-flash", "gemini-1.5-pro"]
                    build_config["model_name"]["value"] = "gemini-1.5-flash"
                    build_config["api_key"]["display_name"] = "Google API Key"
                    
            elif field_name == "use_custom_model":
                if field_value:
                    build_config["custom_model_name"]["show"] = True
                    build_config["model_name"]["show"] = False
                else:
                    build_config["custom_model_name"]["show"] = False
                    build_config["model_name"]["show"] = True
                    
            elif field_name == "langchainjs_export":
                if field_value:
                    build_config["enable_runnable_interface"]["show"] = True
                    build_config["enable_json_mode"]["show"] = True
                else:
                    build_config["enable_runnable_interface"]["show"] = False
                    
            return build_config
        # 在你的组件中添加memory处理方法
        def format_memory_for_export(self, memory_message):
            """格式化memory为导出友好的格式"""
            if not memory_message:
                return None
    
            # 提取ChatMemory内容
            memory_content = memory_message.text if hasattr(memory_message, 'text') else str(memory_message)
    
            # 解析对话历史
            conversations = []
            lines = memory_content.split('\n')
            for line in lines:
                if line.startswith('Human:') or line.startswith('User:'):
                    conversations.append({"role": "user", "content": line.split(':', 1)[1].strip()})
                elif line.startswith('Assistant:') or line.startswith('AI:'):
                    conversations.append({"role": "assistant", "content": line.split(':', 1)[1].strip()})
    
            return {
                "type": "chat_memory",
                "messages": conversations[-10:],  # 保留最近10轮对话
                "format": "langchain_compatible"
            }
        # 统一的memory metadata格式
        def create_memory_metadata(self, memory_data):
            return {
                "memory": {
                    "has_memory": bool(memory_data),
                    "format": "langflow_chat_memory",
                    "messages": memory_data.get("messages", []) if memory_data else [],
                    "export_ready": True
                },
                "langchain_export": {
                    "memory_compatible": True,
                    "vercel_ready": True
                }
            }
    
