import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Box,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';

interface Project {
  id: string;
  name: string;
  updated_at: string;
  branches: Branch[];
}

interface Branch {
  id: string;
  name: string;
  steps: Step[];
}

interface Step {
  name: string;
  step: number;
}

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        // This would be a real API call in production
        // For now, we'll simulate it with a timeout
        setTimeout(() => {
          setProjects([
            {
              id: '1',
              name: 'Sample Project',
              updated_at: new Date().toISOString(),
              branches: [
                {
                  id: '1',
                  name: 'main',
                  steps: [
                    { name: 'Initial setup', step: 1 },
                    { name: 'Latest step', step: 2 },
                  ],
                },
              ],
            },
          ]);
          setLoading(false);
        }, 1000);
      } catch (err) {
        setError('Failed to load projects');
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    try {
      // This would be a real API call in production
      // For now, we'll simulate it with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const newProject: Project = {
        id: Date.now().toString(),
        name: newProjectName,
        updated_at: new Date().toISOString(),
        branches: [
          {
            id: Date.now().toString(),
            name: 'main',
            steps: [],
          },
        ],
      };
      
      setProjects([...projects, newProject]);
      setNewProjectDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (err) {
      setError('Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setNewProjectDialogOpen(true)}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {projects.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No projects yet
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Create your first project to get started with GPT Pilot.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setNewProjectDialogOpen(true)}
          >
            Create Project
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last updated: {new Date(project.updated_at).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Branches: {project.branches.length}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/project/${project.id}`}
                  >
                    Open
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={newProjectDialogOpen} onClose={() => setNewProjectDialogOpen(false)}>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Project Description"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewProjectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            disabled={!newProjectName.trim() || creatingProject}
          >
            {creatingProject ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Dashboard; 