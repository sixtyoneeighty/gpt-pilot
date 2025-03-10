import datetime
import re
from typing import Optional, Tuple

import anthropic
from httpx import Timeout
from anthropic import AsyncAnthropic, RateLimitError

from core.config import LLMProvider
from core.llm.base import BaseLLMClient
from core.llm.convo import Convo
from core.log import get_logger

log = get_logger(__name__)
MAX_TOKENS = 4096
MAX_TOKENS_SONNET = 4096

# Custom exception when Anthropic stream doesn't provide a final message
class CustomAssertionError(Exception):
    pass

class BedrockClient(BaseLLMClient):
    provider = LLMProvider.BEDROCK

    def _init_client(self):
        # Bedrock uses the Anthropic client but with specific base_url and headers
        self.client = AsyncAnthropic(
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            timeout=Timeout(
                max(self.config.connect_timeout, self.config.read_timeout),
                connect=self.config.connect_timeout,
                read=self.config.read_timeout,
            ),
        )
        self.stream_handler = self.stream_handler

    def _adapt_messages(self, convo: Convo) -> list[dict[str, str]]:
        """
        Adapt the conversation messages to the format expected by the Anthropic Claude model.

        Claude only recognizes "user" and "assistant" roles, and requires them to be switched
        for each message (i.e. no consecutive messages from the same role).

        :param convo: Conversation to adapt.
        :return: Adapted conversation messages.
        """
        messages = []
        for msg in convo.messages:
            if msg["role"] == "function":
                raise ValueError("Anthropic Claude doesn't support function calling")

            role = "user" if msg["role"] in ["user", "system"] else "assistant"
            if messages and messages[-1]["role"] == role:
                messages[-1]["content"] += "\n\n" + msg["content"]
            else:
                messages.append(
                    {
                        "role": role,
                        "content": msg["content"],
                    }
                )
        return messages

    async def _make_request(
        self, convo: Convo, temperature: Optional[float] = None, json_mode: bool = False, retry_count: int = 1
    ) -> Tuple[str, int, int]:
        import asyncio

        async def single_attempt() -> Tuple[str, int, int]:
            messages = self._adapt_messages(convo)
            completion_kwargs = {
                "max_tokens": MAX_TOKENS,
                "model": self.config.model,
                "messages": messages,
                "temperature": self.config.temperature if temperature is None else temperature,
                "extra_headers": {"anthropic-version": "bedrock-2023-05-31"}
            }

            if "sonnet" in self.config.model:
                completion_kwargs["max_tokens"] = MAX_TOKENS_SONNET

            if json_mode:
                completion_kwargs["response_format"] = {"type": "json_object"}

            response = []
            async with self.client.messages.stream(**completion_kwargs) as stream:
                async for content in stream.text_stream:
                    response.append(content)
                    if self.stream_handler:
                        await self.stream_handler(content)

                try:
                    final_message = await stream.get_final_message()
                    final_message.content  # Access content to verify it exists
                except AssertionError:
                    log.debug("Anthropic package AssertionError")
                    raise CustomAssertionError("No final message received.")

            response_str = "".join(response)

            # Tell the stream handler we're done
            if self.stream_handler:
                await self.stream_handler(None)

            return response_str, final_message.usage.input_tokens, final_message.usage.output_tokens

        for attempt in range(retry_count + 1):
            try:
                return await single_attempt()
            except CustomAssertionError as e:
                if attempt == retry_count:  # If this was our last attempt
                    raise CustomAssertionError(f"Request failed after {retry_count + 1} attempts: {str(e)}")
                # Add a small delay before retrying
                await asyncio.sleep(1)
                continue

    def rate_limit_sleep(self, err: RateLimitError) -> Optional[datetime.timedelta]:
        """
        Amazon Bedrock may use different rate limiting headers than Anthropic,
        but we'll start with the same implementation and adjust as needed.
        """
        headers = err.response.headers
        if "anthropic-ratelimit-tokens-remaining" not in headers:
            return None

        remaining_tokens = headers["anthropic-ratelimit-tokens-remaining"]
        if remaining_tokens == 0:
            relevant_dt = headers["anthropic-ratelimit-tokens-reset"]
        else:
            relevant_dt = headers["anthropic-ratelimit-requests-reset"]

        try:
            reset_time = datetime.datetime.fromisoformat(relevant_dt)
        except ValueError:
            return datetime.timedelta(seconds=5)

        try:
            now = datetime.datetime.now(tz=datetime.timezone.utc)
        except Exception:
            now = datetime.datetime.now(tz=datetime.timezone.utc)

        return reset_time - now


__all__ = ["BedrockClient"] 