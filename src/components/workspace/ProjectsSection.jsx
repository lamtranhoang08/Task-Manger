import React from 'react';
import ProjectCard from './ProjectCard';

const ProjectsSection = ({ projects, onEditProject, onDeleteProject, onTaskCreated }) => (
  <div className="lg:col-span-2 space-y-6">
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Recent Projects</h2>
        <button className="text-blue-600 text-sm font-medium hover:text-blue-800">
          View all →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={onEditProject}
            onDelete={onDeleteProject}
            onTaskCreated={onTaskCreated}
          />
        ))}
      </div>
    </div>
  </div>
);

export default ProjectsSection;