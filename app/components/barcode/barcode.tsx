"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

interface BarcodeProps {
    valor: string
    className?: string
}

/** Renderiza um código de barras Code128 em SVG a partir de um valor de texto. */
export default function Barcode({ valor, className }: BarcodeProps) {
    const svgRef = useRef<SVGSVGElement | null>(null)

    useEffect(() => {
        if (!svgRef.current || !valor) return

        JsBarcode(svgRef.current, valor, {
            format: "CODE128",
            displayValue: true,
            fontSize: 14,
            height: 60,
            margin: 8,
            background: "#FFFFFF",
            lineColor: "#1C1B19",
        })
    }, [valor])

    return <svg ref={svgRef} className={className} />
}
