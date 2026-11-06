"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

function InputGroupPasswordInput({
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "type">) {
  const [visivel, setVisivel] = React.useState(false)

  return (
    <>
      <InputGroupInput type={visivel ? "text" : "password"} {...props} />
      <InputGroupAddon
        align="inline-end"
        className="mr-6 opacity-0 transition-opacity group-hover/input-group:opacity-100 has-focus-visible:opacity-100"
      >
        <InputGroupButton
          type="button"
          size="icon-sm"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
          className="size-9 hover:bg-transparent dark:hover:bg-transparent"
        >
          {visivel ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </InputGroupButton>
      </InputGroupAddon>
    </>
  )
}

export { InputGroupPasswordInput }
