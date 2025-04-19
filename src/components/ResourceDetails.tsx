import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useHyphaStore } from '../store/hyphaStore';
import ReactMarkdown from 'react-markdown';
import { Resource } from '../types/resource';
import { Button, Box, Typography, Chip, Grid, Card, CardContent, Avatar, Stack, Divider, IconButton } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import LinkIcon from '@mui/icons-material/Link';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UpdateIcon from '@mui/icons-material/Update';
import { resolveHyphaUrl } from '../utils/urlHelpers';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import Link from '@mui/material/Link';
import ChatIcon from '@mui/icons-material/Chat';
import { SITE_ID, SERVER_URL } from '../utils/env';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SettingsIcon from '@mui/icons-material/Settings';
import MessageIcon from '@mui/icons-material/Message';
import CodeIcon from '@mui/icons-material/Code';

const ResourceDetails = () => {
  const { id } = useParams();
  const { selectedResource: rawResource, fetchResource, isLoading, error } = useHyphaStore();
  const [documentation, setDocumentation] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Store covers in a local variable
  const covers = rawResource?.manifest.covers || [];

  // Add this variable to control button state
  const shouldDisableChat = !rawResource?.manifest?.type?.includes('agent');

  useEffect(() => {
    if (id) {
      fetchResource(`${SITE_ID}/${id}`);
    }
  }, [id, fetchResource]);

  useEffect(() => {
    const fetchDocumentation = async () => {
      if (rawResource?.manifest.documentation) {
        try {
          const docUrl = resolveHyphaUrl(rawResource.manifest.documentation, rawResource.id);
          
          const response = await fetch(docUrl);
          const text = await response.text();
          setDocumentation(text);
        } catch (error) {
          console.error('Failed to fetch documentation:', error);
        }
      }
    };

    fetchDocumentation();
  }, [rawResource?.id, rawResource?.manifest.documentation]);

  const handleDownload = () => {
    if (id) {
      window.open(`${SERVER_URL}/${SITE_ID}/artifacts/${id}/create-zip-file`, '_blank');
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (covers.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % covers.length);
    }
  };

  const previousImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (covers.length > 0) {
      setCurrentImageIndex((prev) => 
        (prev - 1 + covers.length) % covers.length
      );
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!rawResource) {
    return <div>Resource not found</div>;
  }

  const selectedResource = rawResource as unknown as Resource;
  const { manifest } = selectedResource;
  const isAgent = manifest.type?.includes('agent');

  const renderAgentConfig = () => {
    if (!isAgent) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <SmartToyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Agent Configuration
          </Typography>
          
          <Stack spacing={3}>
            {/* Welcome Message */}
            <Box>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                <MessageIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                Welcome Message
              </Typography>
              <Typography variant="body1">
                {manifest.welcomeMessage || 'No welcome message set'}
              </Typography>
            </Box>

            {/* System Instructions */}
            <Box>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                <CodeIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                System Instructions
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  bgcolor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  fontFamily: 'monospace'
                }}
              >
                {manifest.startup_script || 'No system instructions set'}
              </Typography>
            </Box>

            {/* Model Configuration */}
            {manifest.modelConfig && (
              <Box>
                <Typography variant="subtitle1" color="primary" gutterBottom>
                  <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                  Model Configuration
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Model:</strong> {manifest.modelConfig.model}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Temperature:</strong> {manifest.modelConfig.temperature}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Base URL:</strong> {manifest.modelConfig.baseURL}
                  </Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {manifest.id_emoji} {manifest.name} 
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          ID: {selectedResource.id}
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>{manifest.description}</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            component={RouterLink}
            to={`/lab?agent=${encodeURIComponent(selectedResource.id)}`}
            variant="contained"
            size="medium"
            startIcon={<ChatIcon />}
            disabled={!isAgent}
            sx={{
              backgroundColor: '#3b82f6',
              '&:hover': {
                backgroundColor: '#2563eb',
              },
              '&.Mui-disabled': {
                backgroundColor: '#d1d5db',
              },
            }}
          >
            Start Chat
          </Button>
          {manifest.version && (
            <Chip 
              icon={<UpdateIcon />} 
              label={`Version: ${manifest.version}`}
              sx={{ ml: 2 }} 
            />
          )}
        </Box>
      </Box>

      {/* Cover Image Section */}
      {covers.length > 0 && (
        <Box 
          sx={{ 
            position: 'relative',
            width: '100%',
            height: '400px',
            mb: 3,
            borderRadius: 1,
            overflow: 'hidden',
            backgroundColor: '#f5f5f5'
          }}
        >
          <img
            src={resolveHyphaUrl(covers[currentImageIndex], selectedResource.id)}
            alt={`Cover ${currentImageIndex + 1}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
          {covers.length > 1 && (
            <>
              <IconButton
                onClick={previousImage}
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  }
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>
              <IconButton
                onClick={nextImage}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  }
                }}
              >
                <NavigateNextIcon />
              </IconButton>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 1,
                  fontSize: '0.875rem'
                }}
              >
                {currentImageIndex + 1} / {covers.length}
              </Box>
            </>
          )}
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Left Column - Documentation and Agent Config */}
        <Grid item xs={12} md={8}>
          {/* Agent Configuration for agent type */}
          {renderAgentConfig()}
          
          {/* Documentation Card */}
          {documentation && (
            <Card sx={{ mb: 3, height: '100%' }}>
              <CardContent>
                <Box 
                  sx={{ 
                    padding: '45px',
                    '& pre': {
                      maxWidth: '100%',
                      overflow: 'auto'
                    },
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto'
                    }
                  }}
                >
                  <ReactMarkdown className="markdown-body">{documentation}</ReactMarkdown>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={4}>

          {/* Authors Card - Moved from left column */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Authors
              </Typography>
              {manifest.authors?.map((author, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {author.name}
                  </Typography>
                  {author.orcid && (
                    <Link 
                      href={`https://orcid.org/${author.orcid}`}
                      target="_blank"
                      sx={{ 
                        display: 'inline-block',
                        fontSize: '0.875rem',
                        mb: 0.5 
                      }}
                    >
                      ORCID: {author.orcid}
                    </Link>
                  )}
                  {author.affiliation && (
                    <Typography variant="body2" color="text.secondary">
                      <SchoolIcon sx={{ fontSize: 'small', mr: 0.5, verticalAlign: 'middle' }} />
                      {author.affiliation}
                    </Typography>
                  )}
                  {index < (manifest.authors?.length ?? 0) - 1 && <Divider sx={{ my: 2 }} />}
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Statistics Card - New */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Stack spacing={1}>
                <Chip 
                  icon={<DownloadIcon />} 
                  label={`Downloads: ${selectedResource.download_count}`}
                  sx={{ justifyContent: 'flex-start' }}
                />
                <Chip 
                  icon={<VisibilityIcon />} 
                  label={`Views: ${selectedResource.view_count}`}
                  sx={{ justifyContent: 'flex-start' }}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Citations Card */}
          {manifest.cite && manifest.cite.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Citations
                </Typography>
                {manifest.cite.map((citation, index) => (
                  <Box key={index}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {citation.text}
                    </Typography>
                    {citation.doi && (
                      <Link 
                        href={`https://doi.org/${citation.doi}`}
                        target="_blank"
                        sx={{ 
                          display: 'inline-block',
                          fontSize: '0.875rem'
                        }}
                      >
                        DOI: {citation.doi}
                      </Link>
                    )}
                    {index < (manifest.cite?.length ?? 0) - 1 && <Divider sx={{ my: 2 }} />}
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tags Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LocalOfferIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {manifest.tags?.map((tag, index) => (
                  <Chip key={index} label={tag} size="small" />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Links Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Links
              </Typography>
              <Stack spacing={1}>
                {manifest.git_repo && (
                  <Link href={manifest.git_repo} target="_blank">
                    GitHub Repository
                  </Link>
                )}
                {manifest.documentation && (
                  <Link href={manifest.documentation} target="_blank">
                    Documentation
                  </Link>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* License Card */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>License</Typography>
              <Typography variant="body1">{manifest.license}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ResourceDetails; 