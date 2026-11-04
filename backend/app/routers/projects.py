from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints

router = APIRouter(prefix="/api/projects", tags=["projects"])

Text = Annotated[str, StringConstraints(strip_whitespace=True)]


class ProjectIn(BaseModel):
    year: int = Field(ge=2000, le=2100, examples=[2026])
    name: Text = Field(min_length=1, max_length=100)
    badge: Text | None = Field(default=None, max_length=100)
    description: Text = Field(min_length=1, max_length=1000)
    tags: list[Text] = Field(default_factory=list, max_length=10)
    urls: list[str] = Field(default_factory=list, max_length=5)


class Project(ProjectIn):
    id: int


# In-memory "database". Restarting the server resets it to this seed data.
projects: list[Project] = [
    Project(
        id=1,
        year=2026,
        name="SocialShell",
        badge="Hacktoberfest Hack Day",
        description=(
            "Full-stack app for UMD students to swipe through campus events and student orgs, "
            "with Snowflake Cortex Search ranking cards by swipe history and student info."
        ),
        tags=["Snowflake", "Full Stack", "SQL"],
        urls=["https://github.com/KerryLuo/SocialShell"],
    ),
    Project(
        id=2,
        year=2026,
        name="MAGNET / ATLAS",
        badge="Pocket FM",
        description=(
            "Multi-agent long-form story generation with character agents, critic revision, and "
            "graph-based world-state tracking, plus a knowledge-graph pipeline for hallucination "
            "and narrative consistency."
        ),
        tags=["LLMs", "Multi-agent", "Knowledge graphs"],
        urls=["https://github.com/PocketFM-Research", "https://arxiv.org/abs/2607.00918"],
    ),
    Project(
        id=3,
        year=2026,
        name="FastSimplex",
        badge="NC State",
        description=(
            "Real-time safety architecture integrating RL controllers into F1TENTH autonomous "
            "racing cars with verifiable safety guarantees, cut per-cycle compute by 56%."
        ),
        tags=["ROS", "RL", "Real-time systems"],
    ),
    Project(
        id=4,
        year=2025,
        name="ASCIIBench",
        badge="Algoverse AI",
        description=(
            "First-author benchmark for whether LLMs and VLMs can generate, classify, and "
            "represent ASCII art. Released a 5,315-image dataset, fine-tuned CLIP weights, and "
            "evaluation code."
        ),
        tags=["Benchmark", "CLIP", "Multimodal"],
        urls=["https://github.com/ASCIIBench/ASCIIBench", "https://arxiv.org/abs/2512.04125"],
    ),
    Project(
        id=5,
        year=2025,
        name="MiniFold",
        description=(
            "Simplified AlphaFold-inspired model for protein backbone prediction using RCSB "
            "PDB/FASTA data, one-hot encoding, multi-head attention, RMSD evaluation, and 3D "
            "visualization of Cα traces."
        ),
        tags=["TensorFlow", "Keras", "NumPy"],
        urls=["https://github.com/KerryLuo/protein-structure-prediction"],
    ),
]
next_id = len(projects) + 1

NOT_FOUND = {404: {"description": "No project with that id"}}


def find(project_id: int) -> Project:
    for p in projects:
        if p.id == project_id:
            return p
    raise HTTPException(404, "Project not found")


@router.get("", response_model=list[Project])
async def list_projects(year: int | None = None) -> list[Project]:
    """All projects, newest year first. Optionally filter with ?year=2026."""
    items = [p for p in projects if year is None or p.year == year]
    return sorted(items, key=lambda p: (-p.year, p.id))


@router.get("/{project_id}", response_model=Project, responses=NOT_FOUND)
async def get_project(project_id: int) -> Project:
    return find(project_id)


@router.post("", response_model=Project, status_code=201, responses={400: {"description": "Invalid body"}})
async def create_project(body: ProjectIn) -> Project:
    global next_id
    project = Project(id=next_id, **body.model_dump())
    next_id += 1
    projects.append(project)
    return project


@router.put("/{project_id}", response_model=Project, responses={**NOT_FOUND, 400: {"description": "Invalid body"}})
async def update_project(project_id: int, body: ProjectIn) -> Project:
    project = find(project_id)
    updated = Project(id=project.id, **body.model_dump())
    projects[projects.index(project)] = updated
    return updated


@router.delete("/{project_id}", status_code=204, responses=NOT_FOUND)
async def delete_project(project_id: int) -> None:
    projects.remove(find(project_id))
