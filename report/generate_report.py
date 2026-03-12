"""Phase 5 — Generate the STRIDE PDF Report (V2 Update).

Produces a 28-33 page academic report using reportlab with:
  - Title page, TOC, 6 main sections, references
  - V1 content: creature model, GA operators, 17 experiments
  - V2 content: CPG/CPG+NN controllers, transfer, perturbation,
    ablation, landscape, gait analysis
  - 7 new V2 tables + 5 V1 tables
  - 15+ V2 figures + 11 V1 figures
  - Pseudocode, formulas, notation table
  - All formatting per SPEC (Times-Roman 11pt, 1-inch margins)

Output: report/stride_report.pdf

Usage:
    python report/generate_report.py
"""

import csv
import math
import os
import pickle
import sys
from pathlib import Path

import numpy as np
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"
RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
OUTPUT_PDF = PROJECT_ROOT / "report" / "stride_report.pdf"

# Page dimensions
PAGE_W, PAGE_H = letter
MARGIN = 1 * inch


# ---------------------------------------------------------------------------
# Page numbering callback
# ---------------------------------------------------------------------------

def _header_footer(canvas, doc):
    """Add page number to bottom center (starting from page 2)."""
    canvas.saveState()
    if doc.page > 1:
        canvas.setFont("Times-Roman", 9)
        canvas.drawCentredString(PAGE_W / 2, 0.5 * inch,
                                  f"Page {doc.page}")
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Custom styles
# ---------------------------------------------------------------------------

def build_styles():
    """Create all paragraph styles used in the report."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "BodyJustify",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=11,
        leading=11 * 1.15,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading1"],
        fontName="Times-Bold",
        fontSize=14,
        leading=18,
        spaceBefore=18,
        spaceAfter=8,
        textColor=colors.HexColor("#1a1a1a"),
    ))

    styles.add(ParagraphStyle(
        "SubsectionHeader",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=12,
        leading=15,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.HexColor("#333333"),
    ))

    styles.add(ParagraphStyle(
        "PseudoCode",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=8.5,
        leading=10.5,
        backColor=colors.HexColor("#F0F0F0"),
        borderColor=colors.HexColor("#CCCCCC"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=8,
    ))

    styles.add(ParagraphStyle(
        "FigCaption",
        parent=styles["Normal"],
        fontName="Times-Italic",
        fontSize=10,
        leading=12,
        alignment=TA_CENTER,
        spaceBefore=4,
        spaceAfter=10,
    ))

    styles.add(ParagraphStyle(
        "TableCaption",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=10,
        leading=12,
        alignment=TA_LEFT,
        spaceBefore=10,
        spaceAfter=4,
    ))

    styles.add(ParagraphStyle(
        "TitleMain",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=22,
        leading=28,
        alignment=TA_CENTER,
        spaceAfter=12,
    ))

    styles.add(ParagraphStyle(
        "TitleSub",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=13,
        leading=16,
        alignment=TA_CENTER,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        "Reference",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=10,
        leading=12,
        leftIndent=24,
        firstLineIndent=-24,
        spaceAfter=4,
    ))

    styles.add(ParagraphStyle(
        "Formula",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=10,
        leading=13,
        alignment=TA_CENTER,
        spaceBefore=6,
        spaceAfter=6,
        textColor=colors.HexColor("#222222"),
    ))

    return styles


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

_STYLES_CACHE = None


def _get_styles():
    global _STYLES_CACHE
    if _STYLES_CACHE is None:
        _STYLES_CACHE = build_styles()
    return _STYLES_CACHE


def add_figure(elements, filename, caption, fig_num, max_width=5.5*inch,
               max_height=3.5*inch):
    """Add a figure with caption. Gracefully skip if file not found."""
    img_path = FIGURES_DIR / filename
    if not img_path.exists():
        return fig_num  # Skip silently

    try:
        img = Image(str(img_path))
        # Scale to fit
        w, h = img.imageWidth, img.imageHeight
        scale = min(max_width / w, max_height / h, 1.0)
        img.drawWidth = w * scale
        img.drawHeight = h * scale
        img.hAlign = "CENTER"

        styles = _get_styles()
        cap = Paragraph(f"Figure {fig_num}: {caption}",
                         styles["FigCaption"])
        elements.append(KeepTogether([img, cap]))
        return fig_num + 1
    except Exception:
        return fig_num


def add_csv_table(elements, csv_filename, caption, tab_num, styles,
                  col_widths=None):
    """Add a CSV table with caption. Skip if file not found."""
    csv_path = RESULTS_DIR / csv_filename
    if not csv_path.exists():
        return tab_num

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if not rows:
            return tab_num

        cap = Paragraph(f"Table {tab_num}: {caption}",
                         styles["TableCaption"])
        elements.append(cap)

        # Create table
        table = Table(rows, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4C9BE8")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#F5F5F5")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 10))
        return tab_num + 1

    except Exception as e:
        print(f"  Warning: Could not add table {csv_filename}: {e}")
        return tab_num


def make_styled_table(elements, data, caption, tab_num, styles,
                      col_widths=None):
    """Create a table from a list-of-lists with standard styling."""
    if not data or len(data) < 2:
        return tab_num

    cap = Paragraph(f"Table {tab_num}: {caption}", styles["TableCaption"])
    elements.append(cap)

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4C9BE8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F5F5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 10))
    return tab_num + 1


def add_pseudocode(elements, title, code_text, styles):
    """Add a pseudocode block with title and gray background."""
    elements.append(Paragraph(title, styles["SubsectionHeader"]))
    # Replace < and > for XML safety
    safe_text = (code_text.replace("&", "&amp;")
                 .replace("<", "&lt;").replace(">", "&gt;"))
    safe_text = safe_text.replace("\n", "<br/>")
    elements.append(Paragraph(safe_text, styles["PseudoCode"]))


def add_formula(elements, formula_text, styles):
    """Add a centered formula in monospace."""
    safe = (formula_text.replace("&", "&amp;")
            .replace("<", "&lt;").replace(">", "&gt;"))
    elements.append(Paragraph(safe, styles["Formula"]))


def load_pkl(filename):
    """Load a pickle file from RESULTS_DIR. Returns None on failure."""
    path = RESULTS_DIR / filename
    if not path.exists():
        print(f"  Warning: {filename} not found")
        return None
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        print(f"  Warning: Could not load {filename}: {e}")
        return None


def load_csv_rows(filename):
    """Load CSV rows from RESULTS_DIR. Returns list of lists."""
    path = RESULTS_DIR / filename
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return list(csv.reader(f))
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def build_title_page(elements, styles):
    """Build the title page."""
    elements.append(Spacer(1, 2 * inch))
    elements.append(Paragraph("STRIDE", styles["TitleMain"]))
    elements.append(Paragraph(
        "Evolving 2D Walkers Using Genetic Algorithms",
        styles["TitleSub"]
    ))
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph(
        "A Study in Optimization Techniques",
        styles["TitleSub"]
    ))
    elements.append(Spacer(1, inch))

    info_style = ParagraphStyle(
        "TitleInfo", parent=styles["Normal"],
        fontName="Times-Roman", fontSize=12, leading=18,
        alignment=TA_CENTER,
    )
    elements.append(Paragraph("Dev Krishna", info_style))
    elements.append(Paragraph("Registration No: 23112015", info_style))
    elements.append(Paragraph(
        "3rd Year, B.Sc. Data Science", info_style))
    elements.append(Paragraph(
        "CHRIST (Deemed to be University), Pune Lavasa Campus", info_style))
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph(
        "Course: Optimisation Techniques (CIA-3)", info_style))
    elements.append(Paragraph("February 2026", info_style))
    elements.append(PageBreak())


def build_toc(elements, styles):
    """Build table of contents page."""
    elements.append(Paragraph("Table of Contents", styles["SectionHeader"]))
    elements.append(Spacer(1, 12))

    toc_items = [
        ("1.", "Introduction", "3"),
        ("2.", "Literature Review", "5"),
        ("3.", "Methodology", "7"),
        ("  3.1", "Creature Model", "7"),
        ("  3.2", "Genetic Encoding", "8"),
        ("  3.3", "GA Operators", "9"),
        ("  3.4", "Sine Controller", "10"),
        ("  3.5", "CPG Controller", "10"),
        ("  3.6", "CPG+NN Controller", "11"),
        ("  3.7", "Fitness Function", "12"),
        ("  3.8", "Terrain System", "13"),
        ("  3.9", "Gait Analysis Metrics", "13"),
        ("4.", "Implementation & Control Parameters", "14"),
        ("  4.1", "Technology Stack", "14"),
        ("  4.2", "Parameter Configuration", "14"),
        ("  4.3", "Experiment Design", "15"),
        ("5.", "Experiment Results", "16"),
        ("  5.1", "Controller Comparison", "16"),
        ("  5.2", "Frozen-NN and Seeded vs Random Init", "17"),
        ("  5.3", "Transfer Testing", "18"),
        ("  5.4", "Perturbation Recovery", "19"),
        ("  5.5", "NN Interpretability", "20"),
        ("  5.6", "Fitness Landscape Analysis", "21"),
        ("  5.7", "Gait Analysis", "22"),
        ("  5.8", "Algorithm Comparison (GA, DE, PSO, CMA-ES)", "23"),
        ("  5.9", "GA Parameter Sensitivity", "24"),
        ("6.", "Discussion", "26"),
        ("  6.1", "Sensory Feedback and Locomotion", "26"),
        ("  6.2", "Training Diversity and Generalization", "26"),
        ("  6.3", "Robustness: Reactive vs Open-Loop Control", "27"),
        ("  6.4", "What the Neural Network Learned", "27"),
        ("  6.5", "Fitness Landscape Structure", "27"),
        ("  6.6", "Biologically Realistic Gaits", "28"),
        ("  6.7", "CPG Seeding: Warm Start Advantage", "28"),
        ("  6.8", "Threats to Validity", "28"),
        ("  6.9", "Future Work", "29"),
        ("", "References", "30"),
    ]

    toc_style = ParagraphStyle(
        "TOCItem", parent=styles["Normal"],
        fontName="Times-Roman", fontSize=11, leading=16,
    )
    for num, title, page in toc_items:
        indent = "    " if num.startswith("  ") else ""
        num = num.strip()
        dots = "." * max(1, 50 - len(f"{indent}{num} {title}"))
        elements.append(Paragraph(
            f"{indent}<b>{num}</b> {title} {dots} {page}",
            toc_style
        ))

    elements.append(PageBreak())


def build_introduction(elements, styles):
    """Section 1: Introduction."""
    elements.append(Paragraph("1. Introduction", styles["SectionHeader"]))

    body = styles["BodyJustify"]

    elements.append(Paragraph(
        "Locomotion is a fundamental challenge in evolutionary robotics and "
        "computational optimization. The task of evolving a 2D bipedal creature "
        "that can walk effectively represents a complex, high-dimensional "
        "optimization problem where traditional gradient-based methods are "
        "inapplicable due to the non-differentiable nature of the physics "
        "simulation.",
        body
    ))

    elements.append(Paragraph(
        "This report presents STRIDE (Simulated Traversal via Iterative "
        "Directed Evolution), a system that uses genetic algorithms to evolve "
        "walking gaits for a simulated 2D bipedal creature. The creature model "
        "features a torso, two legs with knee joints, two arms with spring-based "
        "elbows, and flat feet for ground stability. We investigate three "
        "controller architectures of increasing complexity: (1) a sine-wave "
        "controller with 18 genes, (2) a Central Pattern Generator (CPG) with "
        "Kuramoto-coupled oscillators using 38 genes, and (3) a CPG+NN hybrid "
        "that adds a small neural network for closed-loop sensory modulation "
        "using 96 genes.",
        body
    ))

    elements.append(Paragraph(
        "Inspired by the seminal work of Karl Sims (1994) on evolving virtual "
        "creatures and Ijspeert's (2008) work on central pattern generators "
        "for locomotion, this project explores how different controller "
        "architectures and GA configurations affect the quality, robustness, "
        "and adaptability of evolved walking gaits. We systematically compare "
        "selection methods, mutation strategies, encoding schemes, and "
        "competitive metaheuristic algorithms (DE, PSO, CMA-ES).",
        body
    ))

    elements.append(Paragraph(
        "<b>Problem Statement.</b> Given a 2D bipedal creature with 6 motorized "
        "joints, find the control parameters that maximize forward distance "
        "traveled while maintaining stability. For the sine controller, this "
        "involves optimizing 18 oscillator parameters. For the CPG controller, "
        "38 parameters define coupled oscillator dynamics. For the CPG+NN "
        "controller, 96 parameters encode both CPG dynamics and a neural "
        "network that modulates motor commands based on sensory feedback.",
        body
    ))

    elements.append(Paragraph(
        "The remainder of this report is organized as follows: Section 2 "
        "reviews related work. Section 3 details the methodology including "
        "the creature model, all three controller architectures, and GA "
        "operators. Section 4 describes the implementation. Section 5 presents "
        "results from 26 experiment configurations including controller "
        "comparisons, transfer testing, perturbation recovery, and fitness "
        "landscape analysis. Section 6 discusses findings and limitations.",
        body
    ))

    elements.append(PageBreak())


def build_literature_review(elements, styles):
    """Section 2: Literature Review."""
    elements.append(Paragraph("2. Literature Review", styles["SectionHeader"]))

    body = styles["BodyJustify"]

    elements.append(Paragraph(
        "The evolution of locomotion in virtual creatures has been a rich "
        "area of research since the early 1990s. We review key works organized "
        "by theme: evolutionary robotics foundations, encoding representations, "
        "optimization algorithms, and central pattern generators.",
        body
    ))

    elements.append(Paragraph(
        "2.1 Evolutionary Robotics Foundations",
        styles["SubsectionHeader"]
    ))

    elements.append(Paragraph(
        "Sims (1994) pioneered the evolution of virtual creatures with both "
        "morphology and neural network controllers, demonstrating that complex "
        "behaviors like swimming, walking, and competing for resources could "
        "emerge from evolutionary processes. Lipson and Pollack (2000) extended "
        "this work to physical robots, establishing the sim-to-real transfer "
        "paradigm.",
        body
    ))

    elements.append(Paragraph(
        "2.2 Central Pattern Generators",
        styles["SubsectionHeader"]
    ))

    elements.append(Paragraph(
        "Central pattern generators (CPGs) are neural circuits in biological "
        "organisms that produce rhythmic motor patterns without requiring "
        "sensory feedback. Ijspeert (2008) provided a comprehensive review "
        "of CPG models for locomotion control, showing that Kuramoto-style "
        "coupled oscillators can produce stable gaits when combined with "
        "sensory modulation. This biological architecture inspired our "
        "three-tier controller design.",
        body
    ))

    elements.append(Paragraph(
        "2.3 Encoding and Optimization",
        styles["SubsectionHeader"]
    ))

    elements.append(Paragraph(
        "Cheney et al. (2014) demonstrated that indirect encodings using "
        "CPPNs produce more complex designs than direct encodings. Stanley "
        "and Miikkulainen (2002) introduced NEAT for evolving neural network "
        "topologies. Geijtenbeek et al. (2013) used CMA-ES for muscle-based "
        "bipedal locomotion. Salimans et al. (2017) showed evolution "
        "strategies competitive with reinforcement learning on locomotion "
        "tasks.",
        body
    ))

    elements.append(Paragraph(
        "2.4 Fitness Landscape Analysis",
        styles["SubsectionHeader"]
    ))

    elements.append(Paragraph(
        "Jones and Forrest (1995) introduced Fitness Distance Correlation "
        "(FDC) as a measure of problem difficulty for genetic algorithms. "
        "A positive FDC indicates that higher-fitness solutions tend to be "
        "closer to the global optimum, making the landscape easier to "
        "search. Mouret and Clune (2015) proposed MAP-Elites for illuminating "
        "search spaces, inspiring diversity-preserving approaches.",
        body
    ))

    # Literature summary table
    lit_data = [
        ["Author(s)", "Year", "Method", "Key Finding"],
        ["Sims", "1994", "GA + NN", "First evolved virtual creatures"],
        ["Lipson & Pollack", "2000", "GA", "Sim-to-real transfer"],
        ["Ijspeert", "2008", "CPG review", "Kuramoto CPGs for locomotion"],
        ["Cheney et al.", "2014", "GA + CPPN", "Indirect encoding advantage"],
        ["Stanley & Miikkulainen", "2002", "NEAT", "Topology evolution"],
        ["Jones & Forrest", "1995", "FDC", "Landscape difficulty metric"],
        ["Geijtenbeek et al.", "2013", "CMA-ES", "Muscle-based locomotion"],
        ["Ha", "2019", "RL + Evo", "Morphology-policy co-optimization"],
    ]

    elements.append(Paragraph("Literature Summary",
                               styles["TableCaption"]))
    table = Table(lit_data,
                  colWidths=[1.3*inch, 0.5*inch, 1.0*inch, 3.0*inch],
                  repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4C9BE8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F5F5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)
    elements.append(PageBreak())


def build_methodology(elements, styles, fig_num):
    """Section 3: Methodology (3.1 - 3.9)."""
    elements.append(Paragraph("3. Methodology", styles["SectionHeader"]))
    body = styles["BodyJustify"]

    # ----- 3.1 Creature Model -----
    elements.append(Paragraph("3.1 Creature Model",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The creature is a 2D bipedal figure modeled using pymunk, a 2D "
        "rigid-body physics engine built on Chipmunk. The body plan consists "
        "of a rectangular torso (60x20 pixels), two legs each with upper "
        "(30 px) and lower (25 px) segments connected by hip and knee joints, "
        "two arms with spring-based elbows (DampedRotarySpring), and flat feet "
        "(20x5 px) attached via passive ankle joints for ground stability.",
        body
    ))

    fig_num = add_figure(elements, "creature_diagram.png",
                          "Creature body plan showing torso, limbs, joints, "
                          "and feet. Motorized joints marked in blue; "
                          "spring elbows in green.", fig_num)

    elements.append(Paragraph(
        "Six joints are motorized using PD position controllers: left/right "
        "hips, left/right knees, and left/right shoulders. Each motor tracks "
        "a target angle computed by the active controller. The PD controller "
        "computes the motor rate as:",
        body
    ))
    add_formula(elements,
                "rate = K<sub>p</sub> * (theta_target - theta_current) "
                "- K<sub>d</sub> * omega_rel",
                styles)

    elements.append(Paragraph(
        "where K<sub>p</sub>=30 and K<sub>d</sub>=2 are the proportional and "
        "derivative gains. Joint limits restrict range of motion: hips to "
        "[-60, +60] degrees, knees to [-30, +60] degrees, and shoulders to "
        "[-90, +90] degrees.",
        body
    ))

    # ----- 3.2 Genetic Encoding -----
    elements.append(Paragraph("3.2 Genetic Encoding",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "Each chromosome is a real-valued vector in [0, 1]<super>n</super>. "
        "The chromosome length depends on the controller type:",
        body
    ))
    elements.append(Paragraph(
        "<b>Direct encoding</b> (n=18): Three genes per joint (6 joints x 3 "
        "= 18 genes). Each triplet maps to amplitude A in [0, pi/2], "
        "frequency f in [0.5, 5.0] Hz, and phase phi in [0, 2*pi].",
        body
    ))
    elements.append(Paragraph(
        "<b>Indirect encoding</b> (n=9): Three genes per joint pair with "
        "left-right symmetry enforced by mirroring parameters with a pi "
        "phase offset.",
        body
    ))
    elements.append(Paragraph(
        "<b>CPG encoding</b> (n=38): 18 oscillator genes + 20 coupling genes "
        "(10 directed connections x 2 parameters each).",
        body
    ))
    elements.append(Paragraph(
        "<b>CPG+NN encoding</b> (n=96): 38 CPG genes + 58 neural network "
        "weights (W<sub>1</sub>: 4x6, b<sub>1</sub>: 4, "
        "W<sub>2</sub>: 6x4, b<sub>2</sub>: 6).",
        body
    ))

    fig_num = add_figure(elements, "encoding_diagram.png",
                          "Direct vs. indirect encoding schemes.", fig_num)

    # ----- 3.3 GA Operators -----
    elements.append(Paragraph("3.3 GA Operators",
                               styles["SubsectionHeader"]))

    fig_num = add_figure(elements, "ga_flowchart.png",
                          "Genetic Algorithm flowchart showing the main "
                          "evolutionary loop.", fig_num)

    # Main GA pseudocode
    ga_pseudo = (
        "ALGORITHM: Genetic Algorithm for Locomotion Optimization\n"
        "INPUT:  N (pop size), G (max gens), p_c, p_m, E (elitism)\n"
        "OUTPUT: Best chromosome x* and fitness f(x*)\n\n"
        "1. INITIALIZE P = {x_1, ..., x_N}, each x_i in [0,1]^n\n"
        "2. EVALUATE fitness f(x_i) via physics simulation\n"
        "3. FOR g = 1 TO G:\n"
        "   3a. RECORD best_g, avg_g, diversity_g\n"
        "   3b. ELITISM: Copy top ceil(E*N) to P_next\n"
        "   3c. WHILE |P_next| < N:\n"
        "       i.   SELECT parents (p1, p2)\n"
        "       ii.  CROSSOVER with probability p_c\n"
        "       iii. MUTATE each gene with probability p_m\n"
        "       iv.  ADD offspring to P_next\n"
        "   3d. EVALUATE new individuals\n"
        "   3e. P = P_next\n"
        "4. RETURN x* = argmax f(x_i)"
    )
    add_pseudocode(elements, "Main GA Loop", ga_pseudo, styles)

    # Tournament selection pseudocode
    tourn_pseudo = (
        "TOURNAMENT SELECTION (k=3):\n"
        "1. Sample k individuals uniformly at random from P\n"
        "2. Return the individual with highest fitness"
    )
    add_pseudocode(elements, "Tournament Selection", tourn_pseudo, styles)

    # Roulette selection pseudocode
    roulette_pseudo = (
        "ROULETTE WHEEL SELECTION:\n"
        "1. Shift fitness: f'(x_i) = f(x_i) - min(f) + epsilon\n"
        "2. Compute selection probability:\n"
        "   p(x_i) = f'(x_i) / SUM_j f'(x_j)\n"
        "3. Sample individual proportional to p(x_i)"
    )
    add_pseudocode(elements, "Roulette Wheel Selection",
                   roulette_pseudo, styles)

    # Adaptive mutation pseudocode
    adaptive_pseudo = (
        "ADAPTIVE GAUSSIAN MUTATION:\n"
        "1. Compute decay: p_m(g) = max(0.01, p_m0 * (1 - g/G))\n"
        "2. FOR each gene x_i:\n"
        "   IF random() < p_m(g):\n"
        "     x_i = x_i + N(0, sigma)\n"
        "     x_i = clamp(x_i, 0, 1)"
    )
    add_pseudocode(elements, "Adaptive Gaussian Mutation",
                   adaptive_pseudo, styles)

    # ----- 3.4 Sine Controller -----
    elements.append(Paragraph("3.4 Sine Controller",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The simplest controller uses independent sinusoidal oscillators "
        "for each joint. Each motor target is computed as:",
        body
    ))
    add_formula(elements,
                "theta_j(t) = A_j * sin(2*pi*f_j*t + phi_j)",
                styles)
    elements.append(Paragraph(
        "where A<sub>j</sub> is the amplitude, f<sub>j</sub> is the "
        "frequency, and phi<sub>j</sub> is the phase offset for joint j. "
        "With 6 joints and 3 parameters each, the search space is "
        "18-dimensional. This open-loop controller produces fixed rhythmic "
        "patterns with no ability to respond to perturbations or terrain "
        "changes.",
        body
    ))

    # ----- 3.5 CPG Controller -----
    elements.append(Paragraph("3.5 CPG Controller",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The CPG (Central Pattern Generator) controller uses 6 Kuramoto-"
        "coupled oscillators, one per joint. Unlike independent sine waves, "
        "the oscillators influence each other through directed coupling "
        "connections, enabling coordinated multi-joint patterns to emerge. "
        "The phase dynamics follow:",
        body
    ))
    add_formula(elements,
                "d(phi_i)/dt = 2*pi*f_i + "
                "SUM_j( w_ij * sin(phi_j - phi_i + Phi_ij) )",
                styles)
    elements.append(Paragraph(
        "where phi<sub>i</sub> is the phase of oscillator i, "
        "f<sub>i</sub> is its intrinsic frequency, w<sub>ij</sub> is the "
        "coupling weight from oscillator j to i, and "
        "Phi<sub>ij</sub> is the coupling phase offset. The output "
        "target angle for each joint is:",
        body
    ))
    add_formula(elements,
                "target_i = A_i * sin(phi_i)",
                styles)
    elements.append(Paragraph(
        "The 38-gene encoding allocates 18 genes to 6 oscillators "
        "(amplitude, frequency, phase each) and 20 genes to 10 directed "
        "coupling connections (weight and phase offset each). The coupling "
        "topology connects: hip-knee pairs (bidirectional), left-right hip "
        "and knee pairs (bidirectional), and left-right shoulders "
        "(bidirectional).",
        body
    ))

    fig_num = add_figure(elements, "controller_architecture.png",
                          "Controller architectures: (a) Sine with "
                          "independent oscillators, (b) CPG with Kuramoto "
                          "coupling, (c) CPG+NN with sensory modulation.",
                          fig_num, max_width=6.0*inch, max_height=3.0*inch)

    # ----- 3.6 CPG+NN Controller -----
    elements.append(Paragraph("3.6 CPG+NN Controller",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The CPG+NN controller adds a small feedforward neural network that "
        "modulates CPG outputs based on sensory feedback, enabling closed-loop "
        "reactive control. The system reads 18 proprioceptive sensors (6 joint "
        "angles, 6 angular velocities, 4 torso states, 2 foot contacts), "
        "reduces them to 6 dimensions, and passes them through a 6-4-6 "
        "neural network:",
        body
    ))
    add_formula(elements,
                "hidden = tanh(W1 @ sensors + b1)",
                styles)
    add_formula(elements,
                "m = tanh(W2 @ hidden + b2)",
                styles)
    elements.append(Paragraph(
        "The modulation vector m (in [-1, 1]) scales each CPG target:",
        body
    ))
    add_formula(elements,
                "final_i = cpg_i * (1 + 0.5 * m_i)",
                styles)
    elements.append(Paragraph(
        "This multiplicative modulation preserves the CPG's base rhythm "
        "while allowing the NN to make reactive adjustments of up to "
        "+/-50%. The 96-gene encoding allocates 38 genes to the CPG "
        "subsystem and 58 genes to NN weights (W<sub>1</sub>: 4x6=24, "
        "b<sub>1</sub>: 4, W<sub>2</sub>: 6x4=24, b<sub>2</sub>: 6), "
        "each scaled from [0,1] to [-2, 2].",
        body
    ))

    elements.append(Paragraph(
        "The 6 reduced sensor inputs are: hip L angle, hip R angle, "
        "hip L angular velocity, hip R angular velocity, torso angle, "
        "and left foot contact. The asymmetric selection (only left foot "
        "contact) keeps the NN at 6 inputs / 58 weights, relying on CPG "
        "coupling for right-side timing.",
        body
    ))

    # ----- 3.7 Fitness Function -----
    elements.append(Paragraph("3.7 Fitness Function",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The fitness function rewards forward distance while penalizing "
        "energy use and falling, and rewarding upright posture:",
        body
    ))
    add_formula(elements,
                "F(x) = dx - alpha*E(x) - beta*C(x) + gamma*U(x)",
                styles)
    elements.append(Paragraph(
        "where dx is horizontal distance traveled, E(x) is normalized "
        "energy expenditure, C(x) counts fall events, and U(x) measures "
        "uprightness (mean cosine of torso angle). Default weights: "
        "alpha=0.1, beta=0.5, gamma=10.0.",
        body
    ))

    elements.append(Paragraph(
        "The Cost of Transport (CoT) provides an efficiency metric:",
        body
    ))
    add_formula(elements,
                "CoT = total_energy / (mass * distance * g)",
                styles)
    elements.append(Paragraph(
        "Lower CoT indicates more energy-efficient locomotion. The energy "
        "model uses concentric/eccentric torque: concentric (joint moving "
        "toward target) costs 1x, eccentric (resisting motion) costs 0.5x, "
        "isometric costs 0.25x.",
        body
    ))

    # Notation table
    notation_data = [
        ["Symbol", "Description", "Default / Range"],
        ["N", "Population size", "100"],
        ["G", "Max generations", "75"],
        ["n", "Chromosome length", "18 / 38 / 96"],
        ["p_c", "Crossover probability", "0.8"],
        ["p_m", "Mutation probability (per gene)", "0.05"],
        ["sigma", "Mutation step size (Gaussian std)", "0.1"],
        ["E", "Elitism rate", "0.05"],
        ["k", "Tournament size", "3"],
        ["T_sim", "Simulation duration", "15.0 s"],
        ["alpha", "Energy penalty weight", "0.1"],
        ["beta", "Fall penalty weight", "0.5"],
        ["gamma", "Uprightness bonus weight", "10.0"],
        ["G_80", "Convergence speed (gen to 80% of final)", "--"],
        ["w_ij", "Coupling weight (oscillator j to i)", "[-2, 2]"],
        ["Phi_ij", "Coupling phase offset", "[0, 2*pi]"],
        ["phi_i", "Oscillator phase", "[0, 2*pi]"],
        ["f_i", "Oscillator intrinsic frequency", "[0.5, 5.0] Hz"],
        ["m_i", "NN modulation output for joint i", "[-1, 1]"],
        ["W1, b1", "NN hidden layer weights and biases", "[-2, 2]"],
        ["W2, b2", "NN output layer weights and biases", "[-2, 2]"],
        ["CoT", "Cost of transport", "--"],
        ["D(g)", "Population diversity at generation g", "--"],
    ]
    elements.append(Paragraph("Notation and Default Parameters",
                               styles["TableCaption"]))
    nt = Table(notation_data,
               colWidths=[0.9*inch, 3.0*inch, 1.1*inch], repeatRows=1)
    nt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4C9BE8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F5F5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(nt)

    # ----- 3.8 Terrain System -----
    elements.append(Paragraph("3.8 Terrain System",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "Three terrain types are used: (1) <b>Flat</b> - level ground "
        "providing a controlled baseline, (2) <b>Hill</b> - undulating "
        "terrain with sinusoidal elevation changes testing adaptation, and "
        "(3) <b>Mixed</b> - random selection from flat and hill per "
        "evaluation, training for generalization. Transfer testing also "
        "evaluates on noise-perturbed terrains (5% and 10% Gaussian noise "
        "on segment heights).",
        body
    ))

    # ----- 3.9 Gait Analysis Metrics -----
    elements.append(Paragraph("3.9 Gait Analysis Metrics",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "We analyze evolved gaits using several metrics. <b>Phase symmetry</b> "
        "measures the mean phase difference between left and right hip "
        "oscillations; a value near pi indicates alternating (walking) gait, "
        "while 0 indicates synchronous (hopping) gait. <b>Duty factor</b> "
        "measures the fraction of time each foot is in ground contact. "
        "<b>Cost of transport</b> (CoT) quantifies energy efficiency. "
        "The <b>behavioral fingerprint</b> combines distance, speed, step "
        "frequency, duty factor, torso stability, and CoT into a "
        "multidimensional profile for each creature.",
        body
    ))

    elements.append(PageBreak())
    return fig_num


def build_implementation(elements, styles, fig_num, tab_num):
    """Section 4: Implementation & Control Parameters."""
    elements.append(Paragraph(
        "4. Implementation & Control Parameters",
        styles["SectionHeader"]
    ))
    body = styles["BodyJustify"]

    # 4.1 Tech stack
    elements.append(Paragraph("4.1 Technology Stack",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The system is implemented in Python 3.11 using: pymunk 6.x for 2D "
        "rigid-body physics simulation, NumPy for array operations, SciPy "
        "for statistical tests (Wilcoxon rank-sum, Fisher's exact test), "
        "matplotlib for visualization, and reportlab for PDF generation. "
        "All experiments use seeded random number generators for "
        "deterministic reproducibility.",
        body
    ))

    # 4.2 Parameters
    elements.append(Paragraph("4.2 Parameter Configuration",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "The baseline GA uses: population size N=100, max generations G=75, "
        "crossover rate p<sub>c</sub>=0.8, mutation rate p<sub>m</sub>=0.05 "
        "with Gaussian noise (sigma=0.1), tournament selection (k=3), "
        "elitism rate E=5%, and flat terrain. Each fitness evaluation "
        "requires a full 15-second physics simulation at 60 FPS "
        "(900 timesteps). V2 controllers use the same GA parameters but "
        "with cascade seeding: sine champions seed CPG populations, and CPG "
        "champions seed CPG+NN populations.",
        body
    ))

    elements.append(Paragraph(
        "Creature physics parameters: gravity = (0, -981), PD gains "
        "K<sub>p</sub>=30, K<sub>d</sub>=2, motor max_force=300,000. "
        "Joint limits: hips [-60, +60] deg, knees [-30, +60] deg, "
        "shoulders [-90, +90] deg.",
        body
    ))

    # CPG+NN mutation rates
    elements.append(Paragraph(
        "For the CPG+NN controller, gene-group-specific mutation rates are "
        "used: oscillator genes (0-17) at p<sub>m</sub>=0.03 / sigma=0.05, "
        "coupling genes (18-37) at p<sub>m</sub>=0.05 / sigma=0.10, "
        "and NN genes (38-95) at p<sub>m</sub>=0.08 / sigma=0.15. This "
        "reflects the different sensitivities of each gene group: inherited "
        "oscillator genes need less perturbation than newly introduced "
        "NN weights.",
        body
    ))

    # 4.3 Experiment design
    elements.append(Paragraph("4.3 Experiment Design",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "We conduct 26 experiment configurations organized into two phases. "
        "Phase 1 (V1): 17 sine-controller experiments comparing GA "
        "parameters, each repeated 30 times with seeds 42-71. Phase 2 (V2): "
        "9 experiments with CPG and CPG+NN controllers including transfer "
        "testing, perturbation recovery, sensor ablation, fitness landscape "
        "analysis, and gait characterization.",
        body
    ))

    exp_design = [
        ["Group", "Variants", "Changed Parameter"],
        ["GA vs Random", "baseline, random_search", "Optimization method"],
        ["Selection", "tournament, roulette, rank", "Selection method"],
        ["Mutation", "0.01, 0.05, 0.10, adaptive", "Mutation rate"],
        ["Crossover", "0.6, 0.8, 0.9", "Crossover rate"],
        ["Elitism", "0%, 5%, 10%", "Elitism rate"],
        ["Encoding", "direct (18), indirect (9)", "Encoding type"],
        ["Terrain", "flat, hill, mixed", "Terrain type"],
        ["Algorithms", "GA, DE, PSO, CMA-ES", "Algorithm"],
        ["Controllers", "sine, CPG, CPG+NN (x4)", "Controller type"],
        ["Ablation", "frozen-NN, random init", "Control experiments"],
    ]
    elements.append(Paragraph(f"Table {tab_num}: Experiment Design Overview",
                               styles["TableCaption"]))
    ed = Table(exp_design, colWidths=[1.0*inch, 2.5*inch, 2.0*inch],
               repeatRows=1)
    ed.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4C9BE8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F5F5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(ed)
    tab_num += 1

    elements.append(PageBreak())
    return fig_num, tab_num


# ---------------------------------------------------------------------------
# Section 5: Results
# ---------------------------------------------------------------------------

def build_results_v2(elements, styles, fig_num, tab_num):
    """Section 5.1-5.7: V2 Controller Results."""
    elements.append(Paragraph("5. Experiment Results", styles["SectionHeader"]))
    body = styles["BodyJustify"]

    elements.append(Paragraph(
        "All experiments were run with 30 independent repetitions using "
        "different random seeds (42-71). Statistical comparisons use the "
        "Wilcoxon rank-sum test with significance levels: * (p&lt;0.05), "
        "** (p&lt;0.01), *** (p&lt;0.001). Effect sizes use Cohen's d: "
        "negligible (|d|&lt;0.2), small (0.2-0.5), medium (0.5-0.8), "
        "large (&gt;0.8).",
        body
    ))

    # ===== 5.1 Controller Comparison =====
    elements.append(Paragraph("5.1 Controller Comparison",
                               styles["SubsectionHeader"]))

    # Table 1: Controller comparison from v2_stats.csv
    v2_rows = load_csv_rows("v2_stats.csv")
    display_names = {
        "baseline": "Sine",
        "cpg_baseline": "CPG",
        "cpgnn_flat": "CPG+NN (Flat)",
        "cpgnn_frozen": "CPG+NN (Frozen)",
        "cpgnn_mixed": "CPG+NN (Mixed)",
        "cpgnn_random_init": "CPG+NN (Random)",
        "cpgnn_2x_budget": "CPG+NN (2x Budget)",
        "cpgnn_high_mutation": "CPG+NN (High Mut.)",
    }
    if len(v2_rows) > 1:
        t1_data = [["Controller", "Mean", "Std", "Best", "Worst",
                     "G<sub>80</sub>"]]
        for row in v2_rows[1:]:
            name = display_names.get(row[0], row[0])
            t1_data.append([
                name,
                f"{float(row[2]):.1f}",
                f"{float(row[3]):.1f}",
                f"{float(row[4]):.1f}",
                f"{float(row[5]):.1f}",
                f"{float(row[7]):.1f}",
            ])
        # Wrap header cells in Paragraph for sub tag support
        header_cells = []
        for h in t1_data[0]:
            header_cells.append(Paragraph(
                f"<b><font color='white'>{h}</font></b>",
                ParagraphStyle("th", fontName="Times-Bold", fontSize=9,
                               alignment=TA_CENTER)))
        t1_data[0] = header_cells

        tab_num = make_styled_table(
            elements, t1_data,
            "Controller tier comparison (30 runs each, flat terrain "
            "unless noted)", tab_num, styles,
            col_widths=[1.3*inch, 0.7*inch, 0.7*inch, 0.7*inch,
                        0.7*inch, 0.7*inch]
        )

    elements.append(Paragraph(
        "The CPG+NN controllers with extended budget (2x) achieve the "
        "highest mean fitness, followed by frozen-NN and high-mutation "
        "variants. The CPG controller outperforms sine, confirming that "
        "Kuramoto coupling provides optimization value beyond independent "
        "oscillators. All V2 controllers significantly outperform the sine "
        "baseline (p&lt;0.001, Cohen's d&gt;1.0) except CPG+NN mixed-terrain, "
        "which trains on harder terrain.",
        body
    ))

    fig_num = add_figure(elements, "convergence_v2_controllers.png",
                          "Convergence curves for all controller tiers "
                          "(mean +/- std over 30 runs).", fig_num)
    fig_num = add_figure(elements, "boxplot_controllers.png",
                          "Box plot: controller comparison best fitness "
                          "distribution.", fig_num)

    # ===== 5.2 Frozen-NN and Seeded vs Random =====
    elements.append(Paragraph(
        "5.2 Frozen-NN Control and Seeded vs Random Init",
        styles["SubsectionHeader"]
    ))

    elements.append(Paragraph(
        "The frozen-NN experiment isolates whether CPG+NN's advantage comes "
        "from sensory feedback or simply from having more parameters (96 vs "
        "38). With NN weights locked at zero modulation, the frozen-NN "
        "controller has 96 genes but behaves identically to a CPG. "
        "Surprisingly, frozen-NN achieves high fitness, suggesting that the "
        "expanded search space provides optimization benefit even without "
        "active neural modulation.",
        body
    ))

    # Table 7: Seeded vs Random init
    sr_rows = load_csv_rows("table_v2_seeded_vs_random.csv")
    if len(sr_rows) > 1:
        first_row = sr_rows[1]
        t7_data = [
            ["Metric", "Seeded Init", "Random Init"],
            ["Gen 1 Mean Fitness",
             f"{float(first_row[6]):.1f}" if len(first_row) > 6 else "--",
             f"{float(first_row[7]):.1f}" if len(first_row) > 7 else "--"],
            ["Final Mean Fitness",
             f"{float(first_row[1]):.1f}" if len(first_row) > 1 else "--",
             f"{float(first_row[2]):.1f}" if len(first_row) > 2 else "--"],
            ["Significance", "", first_row[5] if len(first_row) > 5 else ""],
            ["Cohen's d", "", first_row[4] if len(first_row) > 4 else ""],
        ]
        tab_num = make_styled_table(
            elements, t7_data,
            "Seeded vs random initialization for CPG+NN",
            tab_num, styles,
            col_widths=[1.5*inch, 1.5*inch, 1.5*inch]
        )

    elements.append(Paragraph(
        "Cascade seeding (sine -> CPG -> CPG+NN) provides a substantial "
        "warm-start advantage: generation 1 mean fitness is over 2x higher "
        "for seeded populations. By the final generation, seeded init "
        "maintains a statistically significant advantage (p&lt;0.05), "
        "confirming that starting from pre-evolved walking gaits accelerates "
        "convergence.",
        body
    ))

    fig_num = add_figure(elements, "seeded_vs_random_convergence.png",
                          "Convergence comparison: seeded (cascade) vs "
                          "random initialization for CPG+NN.", fig_num)

    # ===== 5.3 Transfer Testing =====
    elements.append(Paragraph("5.3 Transfer Testing",
                               styles["SubsectionHeader"]))

    elements.append(Paragraph(
        "Transfer testing evaluates each controller's ability to generalize "
        "beyond its training terrain. All 30 best chromosomes per controller "
        "are evaluated on 5 terrain conditions: flat, hill, mixed, noise-5%, "
        "and noise-10%.",
        body
    ))

    tab_num = add_csv_table(
        elements, "table_transfer_absolute.csv",
        "Transfer testing: absolute fitness on unseen terrains "
        "(mean +/- std, 30 creatures per controller)",
        tab_num, styles
    )

    fig_num = add_figure(elements, "transfer_heatmap.png",
                          "Transfer testing heatmap: absolute fitness "
                          "by controller and terrain type.", fig_num)

    elements.append(Paragraph(
        "The CPG controller shows the strongest overall transfer performance, "
        "maintaining high fitness on flat terrain while degrading gracefully "
        "on hills. CPG+NN flat-trained creatures show more variable transfer "
        "due to their reliance on sensory patterns learned during flat-terrain "
        "training.",
        body
    ))

    # ===== 5.4 Perturbation Recovery =====
    elements.append(Paragraph("5.4 Perturbation Recovery",
                               styles["SubsectionHeader"]))

    elements.append(Paragraph(
        "Perturbation testing measures each controller's ability to recover "
        "from unexpected pushes. All 30 best creatures per controller are "
        "subjected to horizontal impulse pushes at four strength levels "
        "(gentle=500N, moderate=1500N, strong=3000N, violent=5000N) applied "
        "at t=7.5s during a 15-second simulation.",
        body
    ))

    tab_num = add_csv_table(
        elements, "table_perturbation_recovery.csv",
        "Perturbation recovery: survival rates and post-push metrics",
        tab_num, styles
    )

    fig_num = add_figure(elements, "push_filmstrip.png",
                          "Push recovery filmstrip: Sine (top) vs CPG+NN "
                          "(bottom) at four timestamps around push event.",
                          fig_num)
    fig_num = add_figure(elements, "push_survival_curve.png",
                          "Perturbation survival rate vs push strength "
                          "for each controller type.", fig_num)

    elements.append(Paragraph(
        "Both sine and CPG controllers achieve 100% survival at all push "
        "strengths, though their recovery mechanisms differ: sine controllers "
        "passively oscillate back to equilibrium, while CPG coupling enables "
        "coordinated recovery. CPG+NN controllers show slightly lower "
        "survival at violent push strengths, likely due to the sensor timing "
        "mismatch between training and evaluation conditions.",
        body
    ))

    # ===== 5.5 NN Interpretability =====
    elements.append(Paragraph("5.5 NN Interpretability",
                               styles["SubsectionHeader"]))

    elements.append(Paragraph(
        "To understand what the neural network learned, we perform sensor "
        "ablation studies and visualize NN outputs. Each of the 6 sensor "
        "channels is individually replaced with a rolling mean (30-step "
        "window) and the fitness drop is measured across 10 CPG+NN creatures.",
        body
    ))

    tab_num = add_csv_table(
        elements, "table_sensor_ablation.csv",
        "Sensor ablation: fitness impact when each sensor is replaced "
        "with rolling mean",
        tab_num, styles
    )

    fig_num = add_figure(elements, "sensor_ablation_bars.png",
                          "Sensor ablation: percentage fitness drop per "
                          "ablated sensor channel.", fig_num)
    fig_num = add_figure(elements, "nn_output_timeseries.png",
                          "NN output time-series: sensor inputs, NN "
                          "modulation, CPG targets, and final targets "
                          "over 5 seconds.", fig_num,
                          max_width=6.0*inch, max_height=4.5*inch)

    elements.append(Paragraph(
        "The ablation results reveal high variance across creatures, "
        "indicating that different evolved NN solutions rely on different "
        "sensor subsets. The time-series visualization shows that NN "
        "modulation outputs exhibit reactive patterns correlated with "
        "torso angle changes, suggesting the network learned balance "
        "correction rather than gait generation (which the CPG handles).",
        body
    ))

    # ===== 5.6 Fitness Landscape Analysis =====
    elements.append(Paragraph("5.6 Fitness Landscape Analysis",
                               styles["SubsectionHeader"]))

    elements.append(Paragraph(
        "We characterize the fitness landscape structure using three "
        "complementary methods: fitness-distance correlation (FDC), "
        "gene-pair epistasis analysis, and single-gene sensitivity "
        "analysis.",
        body
    ))

    # Table 5: Landscape metrics from pkl
    landscape = load_pkl("landscape_results.pkl")
    if landscape:
        fdc_sine = landscape.get("fdc_sine", {}).get("mean_fdc", float("nan"))
        fdc_cpgnn = landscape.get("fdc_cpgnn", {}).get("mean_fdc",
                                                        float("nan"))
        epi = landscape.get("epistasis_sine", {})
        epi_mean = "--"
        if "mean_matrix" in epi:
            mat = np.array(epi["mean_matrix"])
            mask = ~np.eye(mat.shape[0], dtype=bool)
            epi_mean = f"{np.nanmean(mat[mask]):.4f}"

        sens_sine = landscape.get("sensitivity_sine", {})
        sens_cpgnn = landscape.get("sensitivity_cpgnn", {})
        mean_sens_sine = "--"
        mean_sens_cpgnn = "--"
        if "mean_sensitivity" in sens_sine:
            arr = np.array(sens_sine["mean_sensitivity"])
            mean_sens_sine = f"{np.nanmean(arr):.2f}"
        if "mean_sensitivity" in sens_cpgnn:
            arr = np.array(sens_cpgnn["mean_sensitivity"])
            mean_sens_cpgnn = f"{np.nanmean(arr):.2f}"

        t5_data = [
            ["Metric", "Sine (18 genes)", "CPG+NN (96 genes)"],
            ["FDC (fitness-distance corr.)",
             f"{fdc_sine:.3f}" if not math.isnan(fdc_sine) else "--",
             f"{fdc_cpgnn:.3f}" if not math.isnan(fdc_cpgnn) else "--"],
            ["Mean off-diagonal epistasis", epi_mean, "--"],
            ["Mean gene sensitivity", mean_sens_sine, mean_sens_cpgnn],
        ]
        tab_num = make_styled_table(
            elements, t5_data,
            "Fitness landscape metrics",
            tab_num, styles,
            col_widths=[2.0*inch, 1.5*inch, 1.5*inch]
        )

    fig_num = add_figure(elements, "fdc_scatter.png",
                          "Fitness-distance correlation (FDC) scatter plots "
                          "for sine and CPG+NN search spaces.", fig_num)
    fig_num = add_figure(elements, "epistasis_matrix.png",
                          "Gene-pair epistasis heatmap (sine controller, "
                          "18 genes).", fig_num)
    fig_num = add_figure(elements, "gene_sensitivity_bars.png",
                          "Single-gene sensitivity analysis for sine "
                          "and CPG controllers.", fig_num)

    elements.append(Paragraph(
        "The FDC analysis indicates moderate positive correlation for both "
        "search spaces, meaning fitter solutions tend to be closer to the "
        "best known. The epistasis heatmap reveals strongest interactions "
        "between same-joint gene triplets (amplitude-frequency-phase), "
        "confirming that joint parameters form a tightly coupled subsystem.",
        body
    ))

    # ===== 5.7 Gait Analysis =====
    elements.append(Paragraph("5.7 Gait Analysis",
                               styles["SubsectionHeader"]))

    elements.append(Paragraph(
        "Gait analysis characterizes the locomotion patterns evolved by each "
        "controller tier. We measure phase symmetry between left and right "
        "hips, step frequency, duty factor, and cost of transport.",
        body
    ))

    # Table 6: Gait characteristics summary
    # Build from behavioral_fingerprint.csv
    bf_rows = load_csv_rows("table_behavioral_fingerprint.csv")
    if len(bf_rows) > 1:
        gait_summary = {}
        for row in bf_rows[1:]:
            ctrl = row[0]
            if ctrl not in gait_summary:
                gait_summary[ctrl] = {"distances": [], "cots": [],
                                       "speeds": [], "stabilities": []}
            try:
                dist = float(row[2]) if row[2] != "None" else None
                cot = float(row[9]) if row[9] != "None" else None
                speed = float(row[3]) if row[3] != "None" else None
                stab = float(row[8]) if row[8] != "None" else None
                if dist is not None:
                    gait_summary[ctrl]["distances"].append(dist)
                if cot is not None and math.isfinite(cot) and cot > 0:
                    gait_summary[ctrl]["cots"].append(cot)
                if speed is not None:
                    gait_summary[ctrl]["speeds"].append(speed)
                if stab is not None and math.isfinite(stab):
                    gait_summary[ctrl]["stabilities"].append(stab)
            except (ValueError, IndexError):
                pass

        t6_data = [["Controller", "Mean Dist.", "Mean Speed",
                     "Mean CoT", "Mean Stability"]]
        ctrl_order = ["sine", "cpg", "cpgnn_flat"]
        ctrl_labels = {"sine": "Sine", "cpg": "CPG",
                       "cpgnn_flat": "CPG+NN (Flat)"}
        for c in ctrl_order:
            if c in gait_summary:
                g = gait_summary[c]
                md = f"{np.mean(g['distances']):.1f}" if g["distances"] else "--"
                ms = f"{np.mean(g['speeds']):.1f}" if g["speeds"] else "--"
                mc = f"{np.mean(g['cots']):.4f}" if g["cots"] else "--"
                mst = f"{np.mean(g['stabilities']):.2f}" if g["stabilities"] else "--"
                t6_data.append([ctrl_labels.get(c, c), md, ms, mc, mst])

        if len(t6_data) > 1:
            tab_num = make_styled_table(
                elements, t6_data,
                "Gait characteristics by controller type",
                tab_num, styles,
                col_widths=[1.2*inch, 1.0*inch, 1.0*inch,
                            1.0*inch, 1.0*inch]
            )

    fig_num = add_figure(elements, "gait_symmetry_histogram.png",
                          "Hip phase symmetry histogram by controller type.",
                          fig_num)
    fig_num = add_figure(elements, "behavioral_radar.png",
                          "Behavioral fingerprint radar chart comparing "
                          "sine, CPG, and CPG+NN controllers.", fig_num)
    fig_num = add_figure(elements, "cost_of_transport.png",
                          "Cost of transport comparison across controller "
                          "types.", fig_num)
    fig_num = add_figure(elements, "cpg_phase_convergence.png",
                          "CPG oscillator phase convergence over "
                          "evolutionary generations.", fig_num)

    elements.append(Paragraph(
        "CPG controllers consistently produce alternating gaits with hip "
        "phase differences near pi, while sine controllers rarely achieve "
        "stable walking patterns (most have incommensurate frequencies). "
        "CPG+NN controllers show more varied gait patterns, with some "
        "creatures developing hopping gaits. The CPG controller achieves "
        "the lowest cost of transport, indicating the most energy-efficient "
        "locomotion.",
        body
    ))

    elements.append(PageBreak())
    return fig_num, tab_num


def build_results_v1(elements, styles, fig_num, tab_num):
    """Section 5.8-5.9: V1 GA Parameter Results (kept from V1)."""

    # ===== 5.8 Algorithm Comparison =====
    elements.append(Paragraph(
        "5.8 Algorithm Comparison (GA vs DE vs PSO vs CMA-ES)",
        styles["SubsectionHeader"]
    ))
    body = styles["BodyJustify"]

    elements.append(Paragraph(
        "We compare the genetic algorithm against three competitive "
        "metaheuristic optimization algorithms, all given the same "
        "evaluation budget of 7,500 fitness evaluations.",
        body
    ))

    fig_num = add_figure(elements, "boxplot_algorithms.png",
                          "Algorithm box plot comparison.", fig_num)

    tab_num = add_csv_table(
        elements, "table_algorithm_stats.csv",
        "Algorithm descriptive statistics", tab_num, styles
    )

    # ===== 5.9 GA Parameter Sensitivity =====
    elements.append(Paragraph("5.9 GA Parameter Sensitivity",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "V1 experiments systematically vary GA parameters to understand "
        "their impact on optimization performance.",
        body
    ))

    # Selection
    elements.append(Paragraph("<b>Selection Methods:</b>", body))
    fig_num = add_figure(elements, "boxplot_selection.png",
                          "Selection method comparison.", fig_num)
    tab_num = add_csv_table(
        elements, "table_comparison_selection.csv",
        "Selection method comparison vs baseline", tab_num, styles
    )

    # Mutation
    elements.append(Paragraph("<b>Mutation Rates:</b>", body))
    fig_num = add_figure(elements, "boxplot_mutation.png",
                          "Mutation rate comparison.", fig_num)
    tab_num = add_csv_table(
        elements, "table_comparison_mutation.csv",
        "Mutation rate comparison vs baseline (p_m=0.05)", tab_num, styles
    )

    # Elitism
    elements.append(Paragraph("<b>Elitism:</b>", body))
    tab_num = add_csv_table(
        elements, "table_comparison_elitism.csv",
        "Elitism comparison vs baseline (E=5%)", tab_num, styles
    )

    # Encoding
    elements.append(Paragraph("<b>Encoding:</b>", body))
    tab_num = add_csv_table(
        elements, "table_comparison_encoding.csv",
        "Encoding comparison vs baseline (direct)", tab_num, styles
    )

    # Crossover
    elements.append(Paragraph("<b>Crossover Rate:</b>", body))
    tab_num = add_csv_table(
        elements, "table_comparison_crossover.csv",
        "Crossover rate comparison vs baseline", tab_num, styles
    )

    # Terrain
    elements.append(Paragraph("<b>Terrain:</b>", body))
    tab_num = add_csv_table(
        elements, "table_comparison_terrain.csv",
        "Terrain comparison vs baseline (flat)", tab_num, styles
    )

    # All experiments summary
    fig_num = add_figure(elements, "boxplot_all_experiments.png",
                          "All V1 experiments: best fitness distribution.",
                          fig_num, max_width=6.0*inch, max_height=4.0*inch)

    # Evolution visualization
    fig_num = add_figure(elements, "evolution_snapshots.png",
                          "Evolution snapshots: best creature at select "
                          "generations.", fig_num,
                          max_width=6.5*inch, max_height=3.0*inch)

    elements.append(PageBreak())
    return fig_num, tab_num


# ---------------------------------------------------------------------------
# Section 6: Discussion
# ---------------------------------------------------------------------------

def build_discussion(elements, styles):
    """Section 6: Discussion (6.1-6.9)."""
    elements.append(Paragraph("6. Discussion", styles["SectionHeader"]))
    body = styles["BodyJustify"]

    # ----- 6.1 -----
    elements.append(Paragraph(
        "6.1 Does Sensory Feedback Improve Locomotion?",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "The three-tier controller comparison reveals a clear hierarchy: "
        "CPG+NN (2x budget) > CPG+NN (frozen) > CPG > Sine. The CPG "
        "controller's coupling mechanism provides consistent improvement "
        "over independent sine oscillators by enabling coordinated multi-joint "
        "patterns. However, the benefit of active neural modulation (CPG+NN "
        "vs frozen-NN) is less clear-cut, with the frozen-NN variant "
        "achieving competitive or even higher fitness. This suggests that "
        "the primary advantage of the 96-gene encoding may be the expanded "
        "search space dimensionality rather than closed-loop feedback.",
        body
    ))
    elements.append(Paragraph(
        "The CPG+NN controller with 2x evaluation budget achieves the "
        "highest overall fitness, indicating that the 96-dimensional search "
        "space does contain high-quality solutions but requires more "
        "evaluations to find them. This is consistent with the higher "
        "G<sub>80</sub> values observed for CPG+NN variants.",
        body
    ))

    # ----- 6.2 -----
    elements.append(Paragraph(
        "6.2 Does Training Diversity Enable Generalization?",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "Transfer testing results show that training terrain significantly "
        "impacts generalization. CPG controllers trained on flat terrain "
        "show the strongest absolute transfer performance, maintaining high "
        "fitness across all terrain types. The CPG+NN mixed-terrain variant, "
        "despite lower training fitness, shows better relative retention when "
        "transferred to diverse terrains. This highlights a classic "
        "exploitation-exploration tradeoff: flat-terrain specialists achieve "
        "higher peak performance, while mixed-terrain training produces more "
        "robust but lower-performing gaits.",
        body
    ))

    # ----- 6.3 -----
    elements.append(Paragraph(
        "6.3 Robustness: Reactive vs Open-Loop Control",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "The perturbation results reveal a surprising finding: all controller "
        "types demonstrate high push survival rates, with sine and CPG "
        "controllers achieving 100% survival even at violent push strengths. "
        "The passive stability of the sine controller comes from its "
        "rhythmic oscillation that naturally returns to equilibrium. The "
        "CPG controller benefits from inter-oscillator coupling that "
        "coordinates recovery. CPG+NN controllers show slightly reduced "
        "survival at the highest push strengths, which may be due to a "
        "train-eval mismatch in foot contact sensor timing from an "
        "earlier bug fix.",
        body
    ))

    # ----- 6.4 -----
    elements.append(Paragraph(
        "6.4 What the Neural Network Learned",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "Sensor ablation analysis reveals high variance across creatures, "
        "indicating that different evolved NN solutions develop different "
        "strategies. Some creatures rely heavily on torso angle for balance "
        "correction, while others primarily use hip angle feedback. The "
        "NN output time-series shows reactive modulation patterns: when "
        "the torso tilts, NN outputs increase hip modulation to compensate, "
        "consistent with a learned balance-correction strategy rather than "
        "gait generation (which the CPG handles). The multiplicative "
        "modulation architecture (1 + 0.5*m) ensures the NN can only "
        "adjust, not override, the CPG's base rhythm.",
        body
    ))

    # ----- 6.5 -----
    elements.append(Paragraph(
        "6.5 Fitness Landscape Structure",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "FDC analysis shows moderate positive correlation for both sine "
        "(18-gene) and CPG+NN (96-gene) search spaces, indicating that "
        "higher-fitness solutions tend to cluster near the global optimum. "
        "This favorable landscape structure partially explains the GA's "
        "success. Gene-pair epistasis analysis on the sine controller "
        "reveals strongest interactions within joint parameter triplets "
        "(amplitude-frequency-phase), suggesting that each joint forms "
        "a semi-independent optimization subproblem connected to others "
        "through the physics simulation.",
        body
    ))

    # ----- 6.6 -----
    elements.append(Paragraph(
        "6.6 Evolution Discovers Biologically Realistic Gaits",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "CPG controllers consistently evolve alternating gaits with hip "
        "phase differences near pi, resembling biological walking patterns. "
        "The CPG phase convergence plot shows that evolution reliably "
        "discovers anti-phase hip coordination, a pattern that emerges from "
        "the fitness landscape rather than being explicitly encoded. "
        "In contrast, sine controllers rarely achieve stable walking, with "
        "most creatures having incommensurate frequencies that produce "
        "irregular patterns. This demonstrates that Kuramoto coupling "
        "provides a useful inductive bias toward biologically plausible gaits.",
        body
    ))

    # ----- 6.7 -----
    elements.append(Paragraph(
        "6.7 CPG Seeding: Warm Start Advantage",
        styles["SubsectionHeader"]
    ))
    elements.append(Paragraph(
        "Cascade seeding (sine -> CPG -> CPG+NN) provides a consistent "
        "warm-start advantage: seeded populations start with 2x higher "
        "generation-1 fitness compared to random initialization. The "
        "advantage persists through training, with seeded init achieving "
        "significantly higher final fitness (p&lt;0.05). This validates "
        "the cascade architecture as an effective curriculum learning "
        "strategy, where each controller tier builds on the previous "
        "tier's optimized parameters.",
        body
    ))

    # ----- 6.8 Threats to Validity -----
    elements.append(Paragraph("6.8 Threats to Validity",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "We identify the following threats to the validity of our findings:",
        body
    ))
    threats = [
        ("1. Search space confound.",
         "Controllers have different gene counts (18 vs 38 vs 96) with the "
         "same evaluation budget. The frozen-NN control partially addresses "
         "this by isolating dimensionality from feedback."),
        ("2. FDC locality.",
         "FDC is computed relative to the best-known solution from our runs, "
         "not the true global optimum."),
        ("3. Epistasis scope.",
         "Gene-pair epistasis is only computed for the sine controller "
         "(18 genes). The CPG+NN epistasis structure (96 genes) remains "
         "uncharacterized due to computational cost."),
        ("4. Short landscape simulation.",
         "Landscape analysis uses 5-second simulations, which may reward "
         "fast starters over sustained walkers."),
        ("5. Simulation fidelity.",
         "pymunk provides simplified 2D physics; results may not transfer "
         "to 3D simulators or real robots."),
        ("6. CoT units.",
         "Cost of transport is measured in simulation units and is not "
         "directly comparable to biological values."),
        ("7. Transfer testing scope.",
         "Only a limited set of terrain types and noise levels were tested."),
        ("8. NN training environment.",
         "The NN component is primarily trained on flat terrain, limiting "
         "sensor variation during training."),
        ("9. Perturbation specificity.",
         "Only horizontal pushes are tested; rotational or vertical "
         "perturbations may produce different results."),
        ("10. Seeded vs random diversity confound.",
         "If random-init reaches higher final fitness despite slower "
         "convergence, the optimal CPG+NN solution may lie outside the "
         "basin of the pre-evolved CPG champion."),
    ]
    for title, desc in threats:
        elements.append(Paragraph(
            f"<b>{title}</b> {desc}", body
        ))

    # ----- 6.9 Future Work -----
    elements.append(Paragraph("6.9 Future Work",
                               styles["SubsectionHeader"]))
    elements.append(Paragraph(
        "Several extensions could enhance this work: (a) extending to 3D "
        "physics using MuJoCo for more realistic locomotion, (b) using "
        "larger neural networks or NEAT to evolve network topology alongside "
        "weights, (c) applying novelty search or MAP-Elites to encourage "
        "diverse locomotion strategies, (d) investigating sim-to-real "
        "transfer by deploying evolved controllers on physical robots, and "
        "(e) co-evolving creature morphology alongside the controller "
        "parameters.",
        body
    ))

    elements.append(PageBreak())


def build_references(elements, styles):
    """References section."""
    elements.append(Paragraph("References", styles["SectionHeader"]))

    ref = styles["Reference"]

    refs = [
        '[1] Sims, K. (1994). "Evolving Virtual Creatures." Proceedings of '
        'SIGGRAPH \'94, pp. 15-22. ACM Press. DOI: 10.1145/192161.192167',

        '[2] Lipson, H., &amp; Pollack, J. B. (2000). "Automatic Design and '
        'Manufacture of Robotic Lifeforms." Nature, 406(6799), 974-978. '
        'DOI: 10.1038/35023115',

        '[3] Cheney, N., MacCurdy, R., Clune, J., &amp; Lipson, H. (2014). '
        '"Unshackling Evolution: Evolving Soft Robots with Multiple Materials '
        'and a Powerful Generative Encoding." GECCO \'14, pp. 167-174. '
        'DOI: 10.1145/2576768.2598353',

        '[4] Stanley, K. O., &amp; Miikkulainen, R. (2002). "Evolving Neural '
        'Networks through Augmenting Topologies." Evolutionary Computation, '
        '10(2), 99-127. DOI: 10.1162/106365602320169811',

        '[5] Salimans, T., Ho, J., Chen, X., Szymon, S., &amp; Sutskever, I. '
        '(2017). "Evolution Strategies as a Scalable Alternative to '
        'Reinforcement Learning." arXiv:1703.03864.',

        '[6] Lehman, J., &amp; Stanley, K. O. (2011). "Abandoning Objectives: '
        'Evolution Through the Search for Novelty Alone." Evolutionary '
        'Computation, 19(2), 189-223. DOI: 10.1162/EVCO_a_00025',

        '[7] Geijtenbeek, T., van de Panne, M., &amp; van der Stappen, A. F. '
        '(2013). "Flexible Muscle-Based Locomotion for Bipedal Creatures." '
        'ACM Trans. Graphics, 32(6), Art. 206. DOI: 10.1145/2508363.2508399',

        '[8] Ha, D. (2019). "Reinforcement Learning for Improving Agent '
        'Design." Artificial Life, 25(4), 352-365. DOI: 10.1162/artl_a_00301',

        '[9] Ijspeert, A. J. (2008). "Central Pattern Generators for '
        'Locomotion Control in Animals and Robots: A Review." Neural Networks, '
        '21(4), 642-653. DOI: 10.1016/j.neunet.2008.03.014',

        '[10] Jones, T., &amp; Forrest, S. (1995). "Fitness Distance '
        'Correlation as a Measure of Problem Difficulty for Genetic '
        'Algorithms." Proceedings of ICGA \'95, pp. 184-192.',

        '[11] Mouret, J.-B., &amp; Clune, J. (2015). "Illuminating Search '
        'Spaces by Mapping Elites." arXiv:1504.04909.',

        '[12] pymunk: A 2D physics library for Python. '
        'https://www.pymunk.org/',

        '[13] NumPy: The fundamental package for scientific computing. '
        'https://numpy.org/',

        '[14] SciPy: Fundamental algorithms for scientific computing. '
        'https://scipy.org/',

        '[15] matplotlib: Visualization with Python. '
        'https://matplotlib.org/',

        '[16] ReportLab: PDF generation toolkit. '
        'https://www.reportlab.com/',
    ]

    for r in refs:
        elements.append(Paragraph(r, ref))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def generate_report():
    """Build the complete STRIDE report PDF."""
    print("=" * 60)
    print("  STRIDE — Generating PDF Report (V2)")
    print("=" * 60)

    # Create document
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="STRIDE: Evolving 2D Walkers Using Genetic Algorithms",
        author="Dev Krishna",
    )

    global _STYLES_CACHE
    _STYLES_CACHE = None
    styles = build_styles()
    _STYLES_CACHE = styles
    elements = []

    fig_num = 1
    tab_num = 1

    print("  Building title page...")
    build_title_page(elements, styles)

    print("  Building table of contents...")
    build_toc(elements, styles)

    print("  Building Section 1: Introduction...")
    build_introduction(elements, styles)

    print("  Building Section 2: Literature Review...")
    build_literature_review(elements, styles)

    print("  Building Section 3: Methodology...")
    fig_num = build_methodology(elements, styles, fig_num)

    print("  Building Section 4: Implementation...")
    fig_num, tab_num = build_implementation(elements, styles, fig_num, tab_num)

    print("  Building Section 5.1-5.7: V2 Results...")
    fig_num, tab_num = build_results_v2(elements, styles, fig_num, tab_num)

    print("  Building Section 5.8-5.9: V1 Results...")
    fig_num, tab_num = build_results_v1(elements, styles, fig_num, tab_num)

    print("  Building Section 6: Discussion...")
    build_discussion(elements, styles)

    print("  Building References...")
    build_references(elements, styles)

    # Build PDF
    print(f"\n  Generating PDF...")
    doc.build(elements, onFirstPage=_header_footer,
              onLaterPages=_header_footer)

    print(f"\n  Report saved: {OUTPUT_PDF}")
    print(f"  Figures used: {fig_num - 1}")
    print(f"  Tables used: {tab_num - 1}")
    print("=" * 60)


if __name__ == "__main__":
    generate_report()
