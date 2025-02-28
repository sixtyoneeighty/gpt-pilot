#!/usr/bin/env python
"""
Model Demo Script

This script demonstrates how to use the new OpenAI and Amazon Bedrock models.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import Config, LLMProvider, ProviderConfig, AgentLLMConfig
from core.llm.convo import Convo
from core.llm.base import BaseLLMClient


async def stream_handler(content):
    """Handle streaming responses"""
    if content is None:
        print("\n--- Response complete ---")
    else:
        print(content, end="", flush=True)


async def demonstrate_model(provider, model_name, prompt):
    """Demonstrate a specific model"""
    print(f"\n\n{'=' * 50}")
    print(f"Testing {provider.value} model: {model_name}")
    print(f"{'=' * 50}")
    
    # Create configuration
    config = Config()
    
    # Set up provider config
    if provider not in config.llm:
        config.llm[provider] = ProviderConfig()
    
    # Read API keys from environment variables
    if provider == LLMProvider.OPENAI:
        config.llm[provider].api_key = os.environ.get("OPENAI_API_KEY")
    elif provider == LLMProvider.BEDROCK:
        config.llm[provider].api_key = os.environ.get("BEDROCK_API_KEY")
        region = os.environ.get("AWS_REGION", "us-east-1")
        config.llm[provider].base_url = f"https://bedrock-runtime.{region}.amazonaws.com/model/anthropic/claude-3-7-sonnet-20250219-v1:0"
    
    # Create agent config
    agent_config = AgentLLMConfig(
        provider=provider,
        model=model_name,
        temperature=0.7
    )
    
    # Set up the conversation
    convo = Convo()
    convo.user(prompt)
    
    # Get the client class for the provider
    client_class = BaseLLMClient.for_provider(provider)
    
    # Create the client
    from core.llm.llm_config import LLMConfig
    llm_config = LLMConfig.from_provider_and_agent_configs(config.llm[provider], agent_config)
    client = client_class(llm_config, stream_handler=stream_handler)
    
    # Make the request
    try:
        response, _ = await client(convo)
        print(f"\n\nFull response: {response}")
    except Exception as e:
        print(f"Error: {e}")


async def main():
    """Main function"""
    prompt = "Write a short poem about artificial intelligence and creativity."
    
    # Test OpenAI models
    await demonstrate_model(LLMProvider.OPENAI, "gpt-4o-latest", prompt)
    await demonstrate_model(LLMProvider.OPENAI, "gpt-4.5-preview", prompt)
    
    # Test Bedrock model
    await demonstrate_model(LLMProvider.BEDROCK, "anthropic.claude-3-7-sonnet-20250219-v1:0", prompt)


if __name__ == "__main__":
    asyncio.run(main()) 